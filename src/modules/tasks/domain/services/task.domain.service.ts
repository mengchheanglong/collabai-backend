// src/modules/tasks/domain/services/task.domain.service.ts
//
// Pure task rules with no I/O. Position math for kanban ordering lives here so it is
// unit-testable independent of Prisma.

import { Injectable } from '@nestjs/common';

/** Gap between spaced positions when appending to the end of a column. */
export const POSITION_GAP = 1000;

@Injectable()
export class TaskDomainService {
  /** Next position when appending to the end of a column given its current max. */
  nextPosition(currentMax: number): number {
    return currentMax + POSITION_GAP;
  }

  /**
   * Position to place a task between two neighbours. Pass the position of the task that
   * will sit above (`before`) and below (`after`) the moved task; either may be null when
   * dropping at an edge.
   */
  positionBetween(before: number | null, after: number | null): number {
    if (before === null && after === null) return POSITION_GAP;
    if (before === null) return (after as number) - POSITION_GAP;
    if (after === null) return before + POSITION_GAP;
    return (before + after) / 2;
  }
}
