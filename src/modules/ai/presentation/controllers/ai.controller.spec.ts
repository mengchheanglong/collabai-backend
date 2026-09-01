import { CommandBus } from '@nestjs/cqrs';
import { AiController } from './ai.controller';
import { SuggestSubtasksCommand } from '../../application/commands/suggest-subtasks.command';
import { GenerateDescriptionCommand } from '../../application/commands/generate-description.command';
import { SummarizeCommentsCommand } from '../../application/commands/summarize-comments.command';
import { SearchTasksCommand } from '../../application/commands/search-tasks.command';
import { GenerateTasksCommand } from '../../application/commands/generate-tasks.command';
import { ChatCommand } from '../../application/commands/chat.command';

describe('AiController', () => {
  let controller: AiController;
  let commandBus: jest.Mocked<CommandBus>;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    controller = new AiController(commandBus);
  });

  describe('subtasks', () => {
    it('executes SuggestSubtasksCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({ subtasks: ['Subtask 1', 'Subtask 2'] });

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
      commandBus.execute.mockResolvedValueOnce({ description: 'Generated description text' });

      const res = await controller.description('user-1', {
        title: 'Task Title',
        mode: 'improve',
        currentDescription: 'Draft text',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new GenerateDescriptionCommand('user-1', 'Task Title', 'improve', 'Draft text', undefined),
      );
      expect(res).toEqual({ description: 'Generated description text' });
    });
  });

  describe('summarize', () => {
    it('executes SummarizeCommentsCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({ summary: 'Discussion summary' });

      const res = await controller.summarize('user-1', {
        taskId: '22222222-2222-4222-a222-222222222222',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new SummarizeCommentsCommand('user-1', '22222222-2222-4222-a222-222222222222'),
      );
      expect(res).toEqual({ summary: 'Discussion summary' });
    });
  });

  describe('searchTasks', () => {
    it('executes SearchTasksCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({ taskIds: ['task-1', 'task-2'] });

      const res = await controller.searchTasks('user-1', {
        projectId: '11111111-1111-4111-a111-111111111111',
        query: 'frontend tasks',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new SearchTasksCommand('user-1', '11111111-1111-4111-a111-111111111111', 'frontend tasks'),
      );
      expect(res).toEqual({ taskIds: ['task-1', 'task-2'] });
    });
  });

  describe('generateTasks', () => {
    it('executes GenerateTasksCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({ tasks: [{ title: 'Task 1' }] });

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
      commandBus.execute.mockResolvedValueOnce({ reply: 'Hello! How can I assist you today?' });

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
});
