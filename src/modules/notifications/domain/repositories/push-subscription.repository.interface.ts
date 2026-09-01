// src/modules/notifications/domain/repositories/push-subscription.repository.interface.ts
//
// Port for push subscription persistence. Bound to PUSH_SUBSCRIPTION_REPOSITORY in module.

import { PushSubscriptionEntity } from '../entities/push-subscription.entity';

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol(
  'PUSH_SUBSCRIPTION_REPOSITORY',
);

export interface IPushSubscriptionRepository {
  /** Upsert push subscription by unique endpoint. */
  save(subscription: PushSubscriptionEntity): Promise<void>;

  /** Find all active subscriptions for a given user. */
  findByUserId(userId: string): Promise<PushSubscriptionEntity[]>;

  /** Find subscription by endpoint URL. */
  findByEndpoint(endpoint: string): Promise<PushSubscriptionEntity | null>;

  /** Remove subscription when user unsubscribes or disables push. */
  deleteByEndpoint(endpoint: string): Promise<void>;

  /** Remove subscription scoped strictly to a specific user and endpoint (prevents IDOR). */
  deleteByEndpointAndUserId(endpoint: string, userId: string): Promise<void>;

  /** Remove multiple subscriptions by endpoints (e.g. pruned 410 Gone). */
  deleteByEndpoints(endpoints: string[]): Promise<void>;
}
