import { QueryBus } from '@nestjs/cqrs';
import { ProjectAnalyticsController } from './project-analytics.controller';
import { GetProjectAnalyticsSummaryQuery } from '../../application/queries/get-project-analytics-summary.query';
import { GetProjectAnalyticsBurndownQuery } from '../../application/queries/get-project-analytics-burndown.query';

describe('ProjectAnalyticsController', () => {
  let controller: ProjectAnalyticsController;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(() => {
    queryBus = { execute: jest.fn() } as any;
    controller = new ProjectAnalyticsController(queryBus);
  });

  describe('getSummary', () => {
    it('executes GetProjectAnalyticsSummaryQuery', async () => {
      const summaryResult = {
        totalTasks: 10,
        completedTasks: 4,
        inProgressTasks: 3,
        todoTasks: 3,
        overdueTasks: 1,
        completionRate: 40,
      };
      queryBus.execute.mockResolvedValueOnce(summaryResult);

      const res = await controller.getSummary(
        'user-1',
        '11111111-1111-4111-a111-111111111111',
      );
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetProjectAnalyticsSummaryQuery(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
        ),
      );
      expect(res).toEqual(summaryResult);
    });
  });

  describe('getBurndown', () => {
    it('clamps days between 1 and 60 with default fallback to 14', async () => {
      queryBus.execute.mockResolvedValueOnce([]);

      await controller.getBurndown(
        'user-1',
        '11111111-1111-4111-a111-111111111111',
        '999',
      );
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetProjectAnalyticsBurndownQuery(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          60,
        ),
      );

      queryBus.execute.mockResolvedValueOnce([]);
      await controller.getBurndown(
        'user-1',
        '11111111-1111-4111-a111-111111111111',
        '-10',
      );
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetProjectAnalyticsBurndownQuery(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          14,
        ),
      );

      queryBus.execute.mockResolvedValueOnce([]);
      await controller.getBurndown(
        'user-1',
        '11111111-1111-4111-a111-111111111111',
        'not-a-number',
      );
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetProjectAnalyticsBurndownQuery(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          14,
        ),
      );
    });

    it('handles array injection in days query parameter safely', async () => {
      queryBus.execute.mockResolvedValueOnce([]);

      await controller.getBurndown(
        'user-1',
        '11111111-1111-4111-a111-111111111111',
        ['30', '50'] as any,
      );
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetProjectAnalyticsBurndownQuery(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          30,
        ),
      );
    });
  });
});
