// src/modules/notifications/infrastructure/push/web-push.service.ts
//
// Service wrapping web-push for RFC 8292 Web Push Protocol.
// Handles VAPID key loading, 4KB payload safe truncation, payload serialization/encryption,
// timeout protection, and auto-pruning 410 Gone / 404 Not Found endpoints.

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionEntity } from '../../domain/entities/push-subscription.entity';
import type { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../../domain/repositories/push-subscription.repository.interface';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: string;
    entityId?: string;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Web Push RFC 8291 limits encrypted payload ciphertext to 4096 bytes (4KB).
 * To leave safe headroom for ECDH encryption headers, content-encoding overhead,
 * and authentication tags, plaintext JSON must not exceed 3900 bytes.
 */
export const MAX_PUSH_PAYLOAD_BYTES = 3900;
export const PUSH_REQUEST_TIMEOUT_MS = 10000;

/**
 * Safely truncates a UTF-8 string to stay within a maximum byte budget without
 * splitting multi-byte UTF-8 sequences or orphan surrogate pairs.
 */
export function truncateUtf8(str: string, maxBytes: number): string {
  if (!str) return '';
  if (Buffer.byteLength(str, 'utf8') <= maxBytes) return str;

  const ellipsis = '...';
  const ellipsisBytes = Buffer.byteLength(ellipsis, 'utf8');
  const availableBytes = Math.max(0, maxBytes - ellipsisBytes);
  if (availableBytes === 0) {
    return ellipsis.slice(0, maxBytes);
  }

  // Binary search string character boundary to avoid splitting multi-byte sequences
  let low = 0;
  let high = str.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    let candidate = str.slice(0, mid);

    // Prevent orphan high surrogate at string end
    if (
      candidate.length > 0 &&
      candidate.charCodeAt(candidate.length - 1) >= 0xd800 &&
      candidate.charCodeAt(candidate.length - 1) <= 0xdbff
    ) {
      candidate = candidate.slice(0, -1);
    }

    if (Buffer.byteLength(candidate, 'utf8') <= availableBytes) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Final check for orphan high surrogate in best
  if (
    best.length > 0 &&
    best.charCodeAt(best.length - 1) >= 0xd800 &&
    best.charCodeAt(best.length - 1) <= 0xdbff
  ) {
    best = best.slice(0, -1);
  }

  return best + ellipsis;
}

/**
 * Formats push notification payload into valid JSON adhering strictly to the
 * 4KB Web Push protocol limit, safely truncating long text/metadata without breaking JSON.
 */
export function formatAndTruncatePayload(
  payload: PushPayload,
  maxBytes: number = MAX_PUSH_PAYLOAD_BYTES,
): string {
  const safeTitle = truncateUtf8(payload.title || 'CollabAI Notification', 200);
  const icon = payload.icon || '/favicon.ico';
  const badge = payload.badge || '/favicon.ico';
  const tag = payload.tag || 'collabai-notification';
  const actions = payload.actions || [
    { action: 'open', title: 'Open in CollabAI' },
  ];

  const rawData = payload.data ? { ...payload.data } : {};
  const url = rawData.url || '/board';

  const candidateObj = {
    title: safeTitle,
    body: payload.body || '',
    icon,
    badge,
    tag,
    data: {
      url,
      ...rawData,
    },
    actions,
  };

  let jsonStr = JSON.stringify(candidateObj);
  if (Buffer.byteLength(jsonStr, 'utf8') <= maxBytes) {
    return jsonStr;
  }

  // Level 1: Truncate body while preserving data
  const emptyBodyObj = { ...candidateObj, body: '' };
  const envelopeBytes = Buffer.byteLength(JSON.stringify(emptyBodyObj), 'utf8');
  const availableForBody = Math.max(0, maxBytes - envelopeBytes);

  if (availableForBody > 3) {
    candidateObj.body = truncateUtf8(payload.body || '', availableForBody);
    jsonStr = JSON.stringify(candidateObj);
    if (Buffer.byteLength(jsonStr, 'utf8') <= maxBytes) {
      return jsonStr;
    }
  }

  // Level 2: Prune large non-essential metadata from data and re-truncate body
  const prunedData: { url: string; [key: string]: any } = { url };
  if (rawData.type) prunedData.type = rawData.type;
  if (rawData.entityId) prunedData.entityId = rawData.entityId;
  if (rawData.relatedEntityType)
    prunedData.relatedEntityType = rawData.relatedEntityType;
  if (rawData.relatedEntityId)
    prunedData.relatedEntityId = rawData.relatedEntityId;

  candidateObj.data = prunedData;
  candidateObj.actions = [{ action: 'open', title: 'Open in CollabAI' }];

  const prunedEnvelopeBytes = Buffer.byteLength(
    JSON.stringify({ ...candidateObj, body: '' }),
    'utf8',
  );
  const remainingForBody = Math.max(0, maxBytes - prunedEnvelopeBytes);
  candidateObj.body = truncateUtf8(payload.body || '', remainingForBody);

  jsonStr = JSON.stringify(candidateObj);
  if (Buffer.byteLength(jsonStr, 'utf8') <= maxBytes) {
    return jsonStr;
  }

  // Ultimate fallback: minimal guaranteed payload
  const minimalObj = {
    title: truncateUtf8(safeTitle, 80),
    body: truncateUtf8(payload.body || '', 80),
    icon,
    tag,
    data: { url },
  };
  return JSON.stringify(minimalObj);
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private publicKey: string = '';
  private privateKey: string = '';
  private subject: string = 'mailto:support@collabai.internal';

  constructor(
    private readonly config: ConfigService,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: IPushSubscriptionRepository,
  ) {}

  onModuleInit(): void {
    const envPublic = this.config.get<string>('VAPID_PUBLIC_KEY');
    const envPrivate = this.config.get<string>('VAPID_PRIVATE_KEY');
    const envSubject = this.config.get<string>('VAPID_SUBJECT');

    if (envPublic && envPrivate) {
      this.publicKey = envPublic;
      this.privateKey = envPrivate;
      if (envSubject) this.subject = envSubject;
      this.logger.log('Web Push initialized with configured VAPID credentials.');
    } else {
      // Auto-generate development VAPID keys so PWA push works out of the box
      const keys = webpush.generateVAPIDKeys();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;
      this.logger.warn(
        'VAPID keys not found in environment. Auto-generated ephemeral development keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env for persistent production keys.',
      );
    }

    try {
      webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
    } catch (err) {
      this.logger.error(
        `Failed to set VAPID details: ${(err as Error).message}`,
      );
    }
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  async sendNotification(
    subscription: PushSubscriptionEntity,
    payload: PushPayload,
  ): Promise<boolean> {
    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.p256dh ||
      !subscription.auth
    ) {
      this.logger.warn(
        `Skipping push delivery: invalid subscription object or missing keys.`,
      );
      return false;
    }

    const pushSub: webpush.PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const formattedPayload = formatAndTruncatePayload(payload);

    try {
      const sendPromise = webpush.sendNotification(
        pushSub,
        formattedPayload,
        {
          TTL: 60 * 60 * 24, // 24 hours
          urgency: 'high',
        },
      );

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Web push request timed out after ${PUSH_REQUEST_TIMEOUT_MS}ms`,
              ),
            ),
          PUSH_REQUEST_TIMEOUT_MS,
        );
      });

      try {
        await Promise.race([sendPromise, timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      return true;
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || err?.status || 0);

      // 404 (Not Found) or 410 (Gone) indicates the subscription has expired or user revoked it
      if (statusCode === 404 || statusCode === 410) {
        this.logger.warn(
          `Push subscription expired or gone (HTTP ${statusCode}). Pruning endpoint: ${subscription.endpoint}`,
        );
        try {
          await this.subRepo.deleteByEndpoint(subscription.endpoint);
        } catch (pruneErr) {
          this.logger.error(
            `Failed to prune expired subscription: ${(pruneErr as Error).message}`,
          );
        }
      } else {
        this.logger.error(
          `Web push delivery error to ${subscription.endpoint} [status: ${statusCode || 'N/A'}]: ${err?.message || err}`,
        );
      }
      return false;
    }
  }
}
