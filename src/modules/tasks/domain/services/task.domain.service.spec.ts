// src/modules/tasks/domain/services/task.domain.service.spec.ts
import { POSITION_GAP, TaskDomainService } from './task.domain.service';

describe('TaskDomainService', () => {
  const svc = new TaskDomainService();

  describe('nextPosition', () => {
    it('appends a gap above the current max', () => {
      expect(svc.nextPosition(0)).toBe(POSITION_GAP);
      expect(svc.nextPosition(2000)).toBe(2000 + POSITION_GAP);
    });
  });

  describe('positionBetween', () => {
    it('averages two neighbours', () => {
      expect(svc.positionBetween(1000, 2000)).toBe(1500);
    });
    it('drops at the top (no task above)', () => {
      expect(svc.positionBetween(null, 1000)).toBe(1000 - POSITION_GAP);
    });
    it('drops at the bottom (no task below)', () => {
      expect(svc.positionBetween(1000, null)).toBe(1000 + POSITION_GAP);
    });
    it('handles an empty column', () => {
      expect(svc.positionBetween(null, null)).toBe(POSITION_GAP);
    });
  });
});

describe('TaskEntity move()', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TaskEntity } = require('../entities/task.entity');

  it('sets completedAt when moved to done and clears it when moved back', () => {
    const task = TaskEntity.create({
      id: 't1',
      projectId: 'p1',
      title: 'x',
      createdById: 'u1',
      position: 1000,
    });
    expect(task.completedAt).toBeNull();

    task.move('done', 2000);
    expect(task.status).toBe('done');
    expect(task.completedAt).toBeInstanceOf(Date);

    task.move('in_progress', 3000);
    expect(task.completedAt).toBeNull();
  });
});
