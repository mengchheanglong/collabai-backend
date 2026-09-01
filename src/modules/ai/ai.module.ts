// src/modules/ai/ai.module.ts
//
// Wires the AI module. The AI_PROVIDER port is bound by a factory: an OpenAI-backed
// provider when OPENAI_API_KEY is configured, otherwise a deterministic stub so the app
// still runs. Imports ProjectsModule/TasksModule/CommentsModule for their exported
// repository ports, and AuthModule for the JwtAuthGuard dependency.

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { CommentsModule } from '../comments/comments.module';
import { AiController } from './presentation/controllers/ai.controller';

import { AI_PROVIDER } from './domain/services/ai-provider.interface';
import { OpenAiProvider } from './infrastructure/providers/openai.provider';
import { DeepSeekProvider } from './infrastructure/providers/deepseek.provider';
import { StubAiProvider } from './infrastructure/providers/stub-ai.provider';
import { AiAccessService } from './application/services/ai-access.service';

import { SuggestSubtasksHandler } from './application/commands/suggest-subtasks.handler';
import { GenerateDescriptionHandler } from './application/commands/generate-description.handler';
import { SummarizeCommentsHandler } from './application/commands/summarize-comments.handler';
import { SearchTasksHandler } from './application/commands/search-tasks.handler';
import { GenerateTasksHandler } from './application/commands/generate-tasks.handler';
import { ChatHandler } from './application/commands/chat.handler';

const CommandHandlers = [
  SuggestSubtasksHandler,
  GenerateDescriptionHandler,
  SummarizeCommentsHandler,
  SearchTasksHandler,
  GenerateTasksHandler,
  ChatHandler,
];

@Module({
  imports: [
    CqrsModule,
    SharedModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
  ],
  controllers: [AiController],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('AI_PROVIDER')?.toLowerCase();

        if (provider === 'deepseek') {
          const apiKey = config.get<string>('DEEPSEEK_API_KEY');
          const model = config.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';
          if (apiKey) return new DeepSeekProvider(apiKey, model);
        }

        // Default: OpenAI (fallback to stub if no key).
        const apiKey = config.get<string>('OPENAI_API_KEY');
        const model = config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
        return apiKey
          ? new OpenAiProvider(apiKey, model)
          : new StubAiProvider();
      },
      inject: [ConfigService],
    },
    AiAccessService,
    ...CommandHandlers,
  ],
})
export class AiModule {}
