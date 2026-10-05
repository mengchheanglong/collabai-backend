// src/shared/infrastructure/rabbitmq/rabbitmq.service.spec.ts

import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { RabbitMQService } from './rabbitmq.service';
import { EXCHANGE, QUEUE, RETRY_HEADER } from './rabbitmq.constants';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const flush = () => new Promise((resolve) => setImmediate(resolve));

function config(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

function fakeBroker() {
  const consumers = new Map<string, (msg: any) => void>();
  const publishChannel = {
    on: jest.fn(),
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn((_ex, _rk, _content, _opts, cb: (err?: Error) => void) => {
      cb();
      return true;
    }),
  };
  const consumeChannel = {
    on: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn((queue: string, onMessage: (msg: any) => void) => {
      consumers.set(queue, onMessage);
      return Promise.resolve({ consumerTag: queue });
    }),
    ack: jest.fn(),
    nack: jest.fn(),
  };
  const connection = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    createConfirmChannel: jest.fn().mockResolvedValue(publishChannel),
    createChannel: jest.fn().mockResolvedValue(consumeChannel),
  };
  (amqp.connect as jest.Mock).mockResolvedValue(connection);
  return { connection, publishChannel, consumeChannel, consumers };
}

function delivery(payload: unknown, routingKey: string, retries?: number) {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: { routingKey },
    properties: {
      headers: retries === undefined ? {} : { [RETRY_HEADER]: retries },
    },
  };
}

describe('RabbitMQService', () => {
  let service: RabbitMQService;

  afterEach(async () => {
    await service?.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('when disabled (in-process fallback)', () => {
    beforeEach(async () => {
      service = new RabbitMQService(config({ RABBITMQ_ENABLED: 'false' }));
      await service.onModuleInit();
    });

    it('never connects and reports disabled', () => {
      expect(amqp.connect).not.toHaveBeenCalled();
      expect(service.status).toBe('disabled');
    });

    it('runs the queue worker in-process on the next tick', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.consume(QUEUE.EMAIL, handler);

      await service.publish('email.verify', { to: 'a@b.c', code: '123456' });
      expect(handler).not.toHaveBeenCalled(); // publisher does not wait on the job

      await flush();
      expect(handler).toHaveBeenCalledWith(
        { to: 'a@b.c', code: '123456' },
        'email.verify',
      );
    });

    it('retries a failing in-process job up to 3 more times', async () => {
      const handler = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue(undefined);
      service.consume(QUEUE.PUSH, handler);

      await service.publish('push.broadcast', { userId: 'u1' });
      await flush();
      await flush();

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('drops jobs with an unroutable key without throwing', async () => {
      const handler = jest.fn();
      service.consume(QUEUE.ACTIVITY, handler);
      await expect(
        service.publish('unknown.thing', {}),
      ).resolves.toBeUndefined();
      await flush();
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects a second worker for the same queue', () => {
      service.consume(QUEUE.AI_JOBS, jest.fn());
      expect(() => service.consume(QUEUE.AI_JOBS, jest.fn())).toThrow();
    });
  });

  describe('when the broker is unreachable', () => {
    it('falls back to in-process execution', async () => {
      (amqp.connect as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
      service = new RabbitMQService(config({ RABBITMQ_ENABLED: 'true' }));
      const handler = jest.fn().mockResolvedValue(undefined);
      service.consume(QUEUE.ACTIVITY, handler);

      await service.onModuleInit();
      expect(service.status).toBe('disconnected');

      await service.publish('activity.task.created', { id: 'a1' });
      await flush();
      expect(handler).toHaveBeenCalledWith(
        { id: 'a1' },
        'activity.task.created',
      );
    });
  });

  describe('when connected', () => {
    let broker: ReturnType<typeof fakeBroker>;

    beforeEach(async () => {
      broker = fakeBroker();
      service = new RabbitMQService(
        config({
          RABBITMQ_ENABLED: 'true',
          RABBITMQ_URL: 'amqp://u:p@host:5672',
        }),
      );
    });

    it('declares the topic exchange, DLX and dead-lettered queues', async () => {
      await service.onModuleInit();

      expect(service.status).toBe('connected');
      expect(broker.publishChannel.assertExchange).toHaveBeenCalledWith(
        EXCHANGE.EVENTS,
        'topic',
        { durable: true },
      );
      expect(broker.publishChannel.assertExchange).toHaveBeenCalledWith(
        EXCHANGE.DEAD_LETTER,
        'direct',
        { durable: true },
      );
      expect(broker.publishChannel.assertQueue).toHaveBeenCalledWith(
        QUEUE.EMAIL,
        {
          durable: true,
          deadLetterExchange: EXCHANGE.DEAD_LETTER,
          deadLetterRoutingKey: 'collabai.email.dlq',
        },
      );
      expect(broker.publishChannel.bindQueue).toHaveBeenCalledWith(
        QUEUE.EMAIL,
        EXCHANGE.EVENTS,
        'email.#',
      );
      expect(broker.publishChannel.bindQueue).toHaveBeenCalledWith(
        'collabai.activity.dlq',
        EXCHANGE.DEAD_LETTER,
        'collabai.activity.dlq',
      );
    });

    it('publishes persistent JSON to the events exchange instead of running locally', async () => {
      const handler = jest.fn();
      service.consume(QUEUE.EMAIL, handler);
      await service.onModuleInit();

      await service.publish('email.project-invitation', { to: 'x@y.z' });
      await flush();

      const [exchange, routingKey, content, opts] =
        broker.publishChannel.publish.mock.calls[0];
      expect(exchange).toBe(EXCHANGE.EVENTS);
      expect(routingKey).toBe('email.project-invitation');
      expect(JSON.parse(content.toString())).toEqual({ to: 'x@y.z' });
      expect(opts).toMatchObject({
        persistent: true,
        headers: { [RETRY_HEADER]: 0 },
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('runs the job in-process when the broker does not confirm the publish', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.consume(QUEUE.EMAIL, handler);
      await service.onModuleInit();
      broker.publishChannel.publish.mockImplementationOnce(
        (_ex, _rk, _c, _o, cb: (err?: Error) => void) => {
          cb(new Error('nack'));
          return true;
        },
      );

      await service.publish('email.verify', { to: 'a@b.c' });
      await flush();

      expect(handler).toHaveBeenCalledWith({ to: 'a@b.c' }, 'email.verify');
    });

    it('acks a delivery the worker handled', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.consume(QUEUE.ACTIVITY, handler);
      await service.onModuleInit();

      const msg = delivery({ id: 'a1' }, 'activity.task.created');
      broker.consumers.get(QUEUE.ACTIVITY)!(msg);
      await flush();

      expect(handler).toHaveBeenCalledWith(
        { id: 'a1' },
        'activity.task.created',
      );
      expect(broker.consumeChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('re-publishes a failed delivery with an incremented retry count', async () => {
      service.consume(
        QUEUE.EMAIL,
        jest.fn().mockRejectedValue(new Error('503')),
      );
      await service.onModuleInit();

      const msg = delivery({ to: 'a@b.c' }, 'email.verify', 1);
      broker.consumers.get(QUEUE.EMAIL)!(msg);
      await flush();

      const [, routingKey, , opts] =
        broker.publishChannel.publish.mock.calls[0];
      expect(routingKey).toBe('email.verify');
      expect(opts.headers[RETRY_HEADER]).toBe(2);
      expect(broker.consumeChannel.ack).toHaveBeenCalledWith(msg);
      expect(broker.consumeChannel.nack).not.toHaveBeenCalled();
    });

    it('dead-letters a delivery after the last retry', async () => {
      service.consume(
        QUEUE.EMAIL,
        jest.fn().mockRejectedValue(new Error('503')),
      );
      await service.onModuleInit();

      const msg = delivery({ to: 'a@b.c' }, 'email.verify', 3);
      broker.consumers.get(QUEUE.EMAIL)!(msg);
      await flush();

      expect(broker.publishChannel.publish).not.toHaveBeenCalled();
      expect(broker.consumeChannel.nack).toHaveBeenCalledWith(
        msg,
        false,
        false,
      );
    });

    it('falls back to in-process jobs after the connection drops', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.consume(QUEUE.PUSH, handler);
      await service.onModuleInit();

      const onClose = broker.connection.on.mock.calls.find(
        ([event]) => event === 'close',
      )![1] as () => void;
      onClose();
      expect(service.status).toBe('disconnected');

      await service.publish('push.broadcast', { userId: 'u1' });
      await flush();
      expect(handler).toHaveBeenCalledWith({ userId: 'u1' }, 'push.broadcast');
    });
  });
});
