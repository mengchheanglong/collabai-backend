// src/modules/notifications/domain/services/notification.domain.service.ts
//
// Pure builders for notification content, keeping the copy/templates in one testable
// place. No I/O.

import { Injectable } from '@nestjs/common';
import { NotificationType } from '../value-objects/notification-type.value-object';

export interface NotificationContent {
  type: NotificationType;
  title: string;
  message: string;
}

@Injectable()
export class NotificationDomainService {
  forTaskAssigned(taskTitle: string): NotificationContent {
    return {
      type: 'task_assigned',
      title: 'Task assigned',
      message: `You were assigned to "${taskTitle}"`,
    };
  }

  forMention(): NotificationContent {
    return {
      type: 'comment_mention',
      title: 'You were mentioned',
      message: 'You were mentioned in a comment.',
    };
  }
}
