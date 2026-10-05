import { CommandBus } from '@nestjs/cqrs';
import { AiController } from './ai.controller';
import { SuggestSubtasksCommand } from '../../application/commands/suggest-subtasks.command';
import { GenerateDescriptionCommand } from '../../application/commands/generate-description.command';
import { SummarizeCommentsCommand } from '../../application/commands/summarize-comments.command';
import { SearchTasksCommand } from '../../application/commands/search-tasks.command';
import { GenerateTasksCommand } from '../../application/commands/generate-tasks.command';
import { ChatCommand } from '../../application/commands/chat.command';
import { GenerateProjectInsightsCommand } from '../../application/commands/generate-project-insights.command';
import { ProposeTaskActionsCommand } from '../../application/commands/propose-task-actions.command';
import { ApplyTaskActionsCommand } from '../../application/commands/apply-task-actions.command';
import { EnqueueAiJobCommand } from '../../application/commands/enqueue-ai-job.command';

describe('AiController', () => {
  let controller: AiController;
  let commandBus: jest.Mocked<CommandBus>;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    controller = new AiController(commandBus);
  });

  describe('subtasks', () => {
    it('executes SuggestSubtasksCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        subtasks: ['Subtask 1', 'Subtask 2'],
      });

      const res = await controller.subtasks('user-1', {
        title: 'Build Login Form',
        description: 'React form with validation',
        count: 5,
        projectId: '11111111-1111-4111-a111-111111111111',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new SuggestSubtasksCommand(
          'user-1',
          'Build Login Form',
          5,
          'React form with validation',
          '11111111-1111-4111-a111-111111111111',
        ),
      );
      expect(res).toEqual({ subtasks: ['Subtask 1', 'Subtask 2'] });
    });
  });

  describe('description', () => {
    it('executes GenerateDescriptionCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        description: 'Generated description text',
      });

      const res = await controller.description('user-1', {
        title: 'Task Title',
        mode: 'improve',
        currentDescription: 'Draft text',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new GenerateDescriptionCommand(
          'user-1',
          'Task Title',
          'improve',
          'Draft text',
          undefined,
        ),
      );
      expect(res).toEqual({ description: 'Generated description text' });
    });
  });

  describe('summarize', () => {
    it('executes SummarizeCommentsCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        summary: 'Discussion summary',
      });

      const res = await controller.summarize('user-1', {
        taskId: '22222222-2222-4222-a222-222222222222',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new SummarizeCommentsCommand(
          'user-1',
          '22222222-2222-4222-a222-222222222222',
        ),
      );
      expect(res).toEqual({ summary: 'Discussion summary' });
    });
  });

  describe('searchTasks', () => {
    it('executes SearchTasksCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        taskIds: ['task-1', 'task-2'],
      });

      const res = await controller.searchTasks('user-1', {
        projectId: '11111111-1111-4111-a111-111111111111',
        query: 'frontend tasks',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new SearchTasksCommand(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          'frontend tasks',
        ),
      );
      expect(res).toEqual({ taskIds: ['task-1', 'task-2'] });
    });
  });

  describe('generateTasks', () => {
    it('executes GenerateTasksCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        tasks: [{ title: 'Task 1' }],
      });

      const res = await controller.generateTasks('user-1', {
        projectId: '11111111-1111-4111-a111-111111111111',
        prompt: 'Generate backend security tasks',
        count: 3,
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new GenerateTasksCommand(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          'Generate backend security tasks',
          3,
        ),
      );
      expect(res).toEqual({ tasks: [{ title: 'Task 1' }] });
    });
  });

  describe('chat', () => {
    it('executes ChatCommand with message, projectId, and history', async () => {
      commandBus.execute.mockResolvedValueOnce({
        reply: 'Hello! How can I assist you today?',
      });

      const res = await controller.chat('user-1', {
        message: 'How is the project progressing?',
        projectId: '11111111-1111-4111-a111-111111111111',
        history: [{ role: 'user', content: 'Hi' }],
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new ChatCommand(
          'user-1',
          'How is the project progressing?',
          '11111111-1111-4111-a111-111111111111',
          [{ role: 'user', content: 'Hi' }],
        ),
      );
      expect(res).toEqual({ reply: 'Hello! How can I assist you today?' });
    });
  });

  describe('projectInsights', () => {
    it('executes GenerateProjectInsightsCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        insights: { healthScore: 85 },
      });

      const res = await controller.projectInsights('user-1', {
        projectId: '11111111-1111-4111-a111-111111111111',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new GenerateProjectInsightsCommand(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
        ),
      );
      expect(res).toEqual({ insights: { healthScore: 85 } });
    });
  });

  describe('proposeTaskActions', () => {
    it('executes ProposeTaskActionsCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        id: 'plan-1',
        status: 'pending',
      });

      const res = await controller.proposeTaskActions('user-1', {
        projectId: '11111111-1111-4111-a111-111111111111',
        request: 'Reassign overdue tasks',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new ProposeTaskActionsCommand(
          'user-1',
          '11111111-1111-4111-a111-111111111111',
          'Reassign overdue tasks',
        ),
      );
      expect(res).toEqual({ id: 'plan-1', status: 'pending' });
    });
  });

  describe('applyTaskActions', () => {
    it('executes ApplyTaskActionsCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({
        planId: 'plan-1',
        status: 'applied',
        appliedActionIds: ['action-1'],
      });

      const res = await controller.applyTaskActions('user-1', 'plan-1', {
        actionIds: ['action-1'],
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new ApplyTaskActionsCommand('user-1', 'plan-1', ['action-1']),
      );
      expect(res).toEqual({
        planId: 'plan-1',
        status: 'applied',
        appliedActionIds: ['action-1'],
      });
    });
  });

  describe('enqueueJob', () => {
    it('executes EnqueueAiJobCommand and returns the queued job', async () => {
      commandBus.execute.mockResolvedValueOnce({
        jobId: 'job-1',
        type: 'project-insights',
        status: 'queued',
      });

      const res = await controller.enqueueJob('user-1', {
        type: 'project-insights',
        projectId: '11111111-1111-4111-a111-111111111111',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new EnqueueAiJobCommand(
          'user-1',
          'project-insights',
          '11111111-1111-4111-a111-111111111111',
          undefined,
          undefined,
        ),
      );
      expect(res).toEqual({ jobId: 'job-1', type: 'project-insights', status: 'queued' });
    });
  });
});
