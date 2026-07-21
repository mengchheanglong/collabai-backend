// src/modules/notifications/domain/services/notification.domain.service.spec.ts
import { NotificationDomainService } from './notification.domain.service';
import { NotificationEntity } from '../entities/notification.entity';

describe('NotificationDomainService', () => {
  const svc = new NotificationDomainService();

  it('builds task-assigned content with the task title', () => {
    const c = svc.forTaskAssigned('Build login page');
    expect(c.type).toBe('task_assigned');
    expect(c.title).toBe('Task assigned');
    expect(c.message).toContain('Build login page');
  });

  it('builds mention content', () => {
    const c = svc.forMention();
    expect(c.type).toBe('comment_mention');
    expect(c.title).toBe('You were mentioned');
  });
});

describe('NotificationEntity.markRead', () => {
  it('sets read + readAt once and is idempotent', () => {
    const n = NotificationEntity.create({
      id: 'n1',
      userId: 'u1',
      type: 'task_assigned',
      title: 't',
      message: 'm',
    });
    expect(n.isRead).toBe(false);
    expect(n.readAt).toBeNull();

    n.markRead();
    expect(n.isRead).toBe(true);
    const firstReadAt = n.readAt;
    expect(firstReadAt).toBeInstanceOf(Date);

    n.markRead(); // idempotent — readAt should not move
    expect(n.readAt).toBe(firstReadAt);
  });
});
