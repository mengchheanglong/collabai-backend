// src/modules/notifications/domain/entities/push-subscription.entity.ts
//
// Represents a user's browser / PWA push subscription (RFC 8292 Web Push).
// One user may have multiple subscriptions (e.g. desktop PWA, mobile PWA, tablet).

import { randomUUID } from 'crypto';

export interface PushSubscriptionProps {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePushSubscriptionProps {
  id?: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

export class PushSubscriptionEntity {
  readonly id: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly userAgent: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: PushSubscriptionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.endpoint = props.endpoint;
    this.p256dh = props.p256dh;
    this.auth = props.auth;
    this.userAgent = props.userAgent ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CreatePushSubscriptionProps): PushSubscriptionEntity {
    const now = new Date();
    return new PushSubscriptionEntity({
      id: props.id || randomUUID(),
      userId: props.userId,
      endpoint: props.endpoint,
      p256dh: props.p256dh,
      auth: props.auth,
      userAgent: props.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PushSubscriptionProps): PushSubscriptionEntity {
    return new PushSubscriptionEntity(props);
  }
}
