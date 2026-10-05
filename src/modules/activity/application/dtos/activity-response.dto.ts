// src/modules/activity/application/dtos/activity-response.dto.ts
//
// ActivityDto per API-CONTRACT.md §9 (also the `activity:created` socket payload).

import {
  activityType,
  buildActivityMessage,
} from '../../domain/activity-message';

export interface ActivityRow {
  id: string;
  projectId: string;
  userId: string;
  entityType: string;
  entityId: string | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  message: string | null;
  createdAt: Date;
  user: { id: string; name: string; email: string } | null;
}

export interface ActivityResponse {
  _id: string;
  id: string;
  projectId: string;
  actorId: string;
  actor: { _id: string; name: string; email: string } | null;
  type: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  message: string;
  createdAt: string;
}

export function toActivityResponse(row: ActivityRow): ActivityResponse {
  return {
    _id: row.id,
    id: row.id,
    projectId: row.projectId,
    actorId: row.userId,
    actor: row.user
      ? { _id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
    type: activityType(row.entityType, row.action),
    entityType: row.entityType,
    entityId: row.entityId,
    oldValue: row.oldValue,
    newValue: row.newValue,
    message:
      row.message ??
      buildActivityMessage({
        actorName: row.user?.name ?? 'Someone',
        entityType: row.entityType,
        action: row.action,
        oldValue: row.oldValue,
        newValue: row.newValue,
      }),
    createdAt: row.createdAt.toISOString(),
  };
}

export const ACTIVITY_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
} as const;
