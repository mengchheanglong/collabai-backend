// src/shared/infrastructure/rabbitmq/rabbitmq.constants.ts
//
// Central registry of the RabbitMQ topology (see PHASED-IMPLEMENTATION-PLAN.md, Phase 6).
//
//   collabai.events (topic) ──email.*────► collabai.email
//                           ──ai.*───────► collabai.ai.jobs
//                           ──push.*─────► collabai.notifications.push
//                           ──activity.*─► collabai.activity
//
// Every work queue dead-letters into collabai.dlx, which routes to `<queue>.dlq`.

export const EXCHANGE = {
  EVENTS: 'collabai.events',
  DEAD_LETTER: 'collabai.dlx',
} as const;

export const QUEUE = {
  EMAIL: 'collabai.email',
  AI_JOBS: 'collabai.ai.jobs',
  PUSH: 'collabai.notifications.push',
  ACTIVITY: 'collabai.activity',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/** Routing-key prefix → queue. The prefix is the segment before the first dot. */
export const QUEUE_BY_PREFIX: Record<string, QueueName> = {
  email: QUEUE.EMAIL,
  ai: QUEUE.AI_JOBS,
  push: QUEUE.PUSH,
  activity: QUEUE.ACTIVITY,
};

export const ROUTING_KEY = {
  EMAIL_VERIFY: 'email.verify',
  EMAIL_PASSWORD_RESET: 'email.password-reset',
  EMAIL_PASSWORD_RESET_SUCCESS: 'email.password-reset-success',
  EMAIL_PROJECT_INVITATION: 'email.project-invitation',
  AI_PROJECT_INSIGHTS: 'ai.project-insights',
  AI_GENERATE_TASKS: 'ai.generate-tasks',
  PUSH_BROADCAST: 'push.broadcast',
} as const;

/** Delivery attempts after the first failure before a message is dead-lettered. */
export const MAX_RETRIES = 3;
export const RETRY_HEADER = 'x-retry-count';

export function queueForRoutingKey(routingKey: string): QueueName | undefined {
  return QUEUE_BY_PREFIX[routingKey.split('.')[0]];
}

export function deadLetterQueue(queue: QueueName): string {
  return `${queue}.dlq`;
}
