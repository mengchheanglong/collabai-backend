// src/shared/infrastructure/rabbitmq/rabbitmq.service.ts
//
// Background job bus backed by RabbitMQ (amqplib v2 promise API), implementing IEventBus.
//
//   publish(routingKey, payload)  — enqueue a job on the `collabai.events` topic exchange
//   consume(queue, handler)       — register the worker for a queue (see rabbitmq.constants)
//
// Delivery:
//   - Publishes use a confirm channel, so a message only counts as queued once the broker acks.
//   - A failing handler is re-published with an incremented `x-retry-count` header up to
//     MAX_RETRIES times; after that it is nacked into `collabai.dlx` → `<queue>.dlq`.
//
// Graceful fallback (plan Step 6.4): when RABBITMQ_ENABLED=false, the broker is down, or a
// publish is not confirmed, the job runs in-process on the next tick with the same handler.
// Callers never block on, or fail because of, the broker. Reconnects every 5 s while down.

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { IEventBus } from '../../event-bus/event-bus.interface';
import {
  EXCHANGE,
  MAX_RETRIES,
  QUEUE,
  QUEUE_BY_PREFIX,
  QueueName,
  RETRY_HEADER,
  deadLetterQueue,
  queueForRoutingKey,
} from './rabbitmq.constants';

export type JobHandler = (payload: any, routingKey: string) => Promise<void>;

export type RabbitMQStatus = 'connected' | 'disconnected' | 'disabled';

const RECONNECT_DELAY_MS = 5000;
const CONSUMER_PREFETCH = 5;

@Injectable()
export class RabbitMQService
  implements IEventBus, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMQService.name);
  private readonly url: string;
  private readonly enabled: boolean;

  private connection: amqp.ChannelModel | null = null;
  private publishChannel: amqp.ConfirmChannel | null = null;
  private consumeChannel: amqp.Channel | null = null;
  private readonly handlers = new Map<QueueName, JobHandler>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private warnedUnavailable = false;

  constructor(private readonly config: ConfigService) {
    this.url =
      this.config.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    const rawEnabled = this.config.get<string>('RABBITMQ_ENABLED') ?? 'false';
    this.enabled = rawEnabled.trim().toLowerCase() === 'true';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        'RabbitMQ disabled (RABBITMQ_ENABLED!=true) — background jobs run in-process.',
      );
      return;
    }
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.teardown();
  }

  get status(): RabbitMQStatus {
    if (!this.enabled) return 'disabled';
    return this.publishChannel ? 'connected' : 'disconnected';
  }

  // ---------------------------------------------------------------------------
  // IEventBus
  // ---------------------------------------------------------------------------

  async publish<T = unknown>(routingKey: string, payload: T): Promise<void> {
    const queue = queueForRoutingKey(routingKey);
    if (!queue) {
      this.logger.warn(`No queue routes "${routingKey}" — job dropped.`);
      return;
    }

    if (this.publishChannel) {
      try {
        await this.publishConfirmed(
          this.publishChannel,
          routingKey,
          payload,
          0,
        );
        return;
      } catch (err) {
        this.logger.warn(
          `Publish of "${routingKey}" not confirmed (${(err as Error).message}) — running in-process.`,
        );
      }
    }

    this.runInProcess(queue, routingKey, payload);
  }

  // ---------------------------------------------------------------------------
  // Consumer registration
  // ---------------------------------------------------------------------------

  /** Register the worker for `queue`. One handler per queue; safe to call before connect. */
  consume(queue: QueueName, handler: JobHandler): void {
    if (this.handlers.has(queue)) {
      throw new Error(`A handler is already registered for queue "${queue}"`);
    }
    this.handlers.set(queue, handler);
    if (this.consumeChannel) {
      this.attachConsumer(this.consumeChannel, queue, handler).catch(
        (err: Error) =>
          this.logger.error(
            `Failed to attach consumer [${queue}]: ${err.message}`,
          ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // In-process fallback
  // ---------------------------------------------------------------------------

  private runInProcess(
    queue: QueueName,
    routingKey: string,
    payload: unknown,
  ): void {
    const handler = this.handlers.get(queue);
    if (!handler) {
      this.logger.warn(
        `No worker registered for [${queue}] — "${routingKey}" dropped.`,
      );
      return;
    }
    // Next tick, so the caller (usually a REST request) never waits on the job.
    setImmediate(() => {
      void this.runWithRetries(handler, routingKey, payload);
    });
  }

  private async runWithRetries(
    handler: JobHandler,
    routingKey: string,
    payload: unknown,
  ): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await handler(payload, routingKey);
        return;
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          this.logger.error(
            `In-process job "${routingKey}" failed after ${attempt + 1} attempts: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------------

  private async connect(): Promise<void> {
    try {
      const connection = await amqp.connect(this.url);
      this.connection = connection;

      connection.on('error', (err: Error) => {
        this.logger.warn(`RabbitMQ connection error: ${err.message}`);
      });
      connection.on('close', () => {
        if (this.connection !== connection) return; // closed by our own teardown
        this.publishChannel = null;
        this.consumeChannel = null;
        this.connection = null;
        if (!this.destroyed) {
          this.logger.warn(
            'RabbitMQ connection lost — falling back to in-process jobs.',
          );
          this.scheduleReconnect();
        }
      });

      await this.setupChannels(connection);
      this.warnedUnavailable = false;
      this.logger.log(`RabbitMQ connected (${this.redactedUrl()}).`);
    } catch (err) {
      await this.teardown();
      const message = `RabbitMQ unavailable at ${this.redactedUrl()} — jobs run in-process until it is reachable: ${(err as Error).message}`;
      if (this.warnedUnavailable) this.logger.debug(message);
      else this.logger.warn(message);
      this.warnedUnavailable = true;
      this.scheduleReconnect();
    }
  }

  private async setupChannels(connection: amqp.ChannelModel): Promise<void> {
    const publishChannel = await connection.createConfirmChannel();
    publishChannel.on('error', (err: Error) =>
      this.logger.warn(`Publish channel error: ${err.message}`),
    );
    await this.declareTopology(publishChannel);

    const consumeChannel = await connection.createChannel();
    consumeChannel.on('error', (err: Error) =>
      this.logger.warn(`Consume channel error: ${err.message}`),
    );
    await consumeChannel.prefetch(CONSUMER_PREFETCH);

    this.publishChannel = publishChannel;
    this.consumeChannel = consumeChannel;

    for (const [queue, handler] of this.handlers) {
      await this.attachConsumer(consumeChannel, queue, handler);
    }
  }

  private async declareTopology(ch: amqp.Channel): Promise<void> {
    await ch.assertExchange(EXCHANGE.EVENTS, 'topic', { durable: true });
    await ch.assertExchange(EXCHANGE.DEAD_LETTER, 'direct', { durable: true });

    for (const queue of Object.values(QUEUE)) {
      const dlq = deadLetterQueue(queue);
      await ch.assertQueue(dlq, { durable: true });
      await ch.bindQueue(dlq, EXCHANGE.DEAD_LETTER, dlq);

      await ch.assertQueue(queue, {
        durable: true,
        deadLetterExchange: EXCHANGE.DEAD_LETTER,
        deadLetterRoutingKey: dlq,
      });
      const prefix = Object.entries(QUEUE_BY_PREFIX).find(
        ([, q]) => q === queue,
      )?.[0];
      await ch.bindQueue(queue, EXCHANGE.EVENTS, `${prefix}.#`);
    }
  }

  private async attachConsumer(
    ch: amqp.Channel,
    queue: QueueName,
    handler: JobHandler,
  ): Promise<void> {
    await ch.consume(queue, (msg) => {
      if (msg) void this.handleDelivery(ch, queue, handler, msg);
    });
    this.logger.log(`Worker attached to [${queue}]`);
  }

  private async handleDelivery(
    ch: amqp.Channel,
    queue: QueueName,
    handler: JobHandler,
    msg: amqp.ConsumeMessage,
  ): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const retries = Number(msg.properties.headers?.[RETRY_HEADER] ?? 0);
    try {
      const payload: unknown = JSON.parse(msg.content.toString());
      await handler(payload, routingKey);
      ch.ack(msg);
    } catch (err) {
      const reason = (err as Error).message;
      if (retries < MAX_RETRIES && this.publishChannel) {
        try {
          await this.publishConfirmed(
            this.publishChannel,
            routingKey,
            msg.content,
            retries + 1,
          );
          this.logger.warn(
            `Job "${routingKey}" failed (${reason}) — retry ${retries + 1}/${MAX_RETRIES}`,
          );
          ch.ack(msg);
          return;
        } catch {
          // fall through to dead-lettering
        }
      }
      this.logger.error(
        `Job "${routingKey}" failed (${reason}) — moved to ${deadLetterQueue(queue)}`,
      );
      ch.nack(msg, false, false);
    }
  }

  private publishConfirmed(
    ch: amqp.ConfirmChannel,
    routingKey: string,
    payload: unknown,
    retryCount: number,
  ): Promise<void> {
    const content = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      try {
        ch.publish(
          EXCHANGE.EVENTS,
          routingKey,
          content,
          {
            persistent: true,
            contentType: 'application/json',
            headers: { [RETRY_HEADER]: retryCount },
          },
          (err) =>
            err
              ? reject(err instanceof Error ? err : new Error(String(err)))
              : resolve(),
        );
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private async teardown(): Promise<void> {
    const { connection } = this;
    this.connection = null;
    this.publishChannel = null;
    this.consumeChannel = null;
    try {
      await connection?.close();
    } catch {
      /* already closed */
    }
  }

  private redactedUrl(): string {
    return this.url.replace(/\/\/[^@/]*@/, '//***@');
  }
}
