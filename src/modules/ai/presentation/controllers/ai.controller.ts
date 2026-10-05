// src/modules/ai/presentation/controllers/ai.controller.ts
//
// REST surface for AI features. All routes require a valid access token; project-scoped
// calls additionally require membership (enforced in handlers). The provider key lives
// server-side only. Errors -> AiExceptionFilter.

import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AiExceptionFilter } from '../exception-filters/ai-exception.filter';

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

import {
  ChatDto,
  GenerateDescriptionDto,
  GenerateTasksDto,
  SearchTasksDto,
  SuggestSubtasksDto,
  SummarizeCommentsDto,
} from '../../application/dtos/ai.dto';
import { ProjectInsightsDto } from '../../application/dtos/project-insights.dto';
import { CreateAiJobDto } from '../../application/dtos/ai-jobs.dto';
import {
  ProposeTaskActionsDto,
  ApplyTaskActionsDto,
} from '../../application/dtos/automation-proposals.dto';

@ApiTags('AI')
@ApiBearerAuth('access-token')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@UseFilters(AiExceptionFilter)
export class AiController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('subtasks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suggest subtasks for a task title/description' })
  async subtasks(
    @CurrentUser('id') userId: string,
    @Body() dto: SuggestSubtasksDto,
  ) {
    return this.commandBus.execute(
      new SuggestSubtasksCommand(
        userId,
        dto.title,
        dto.count ?? 5,
        dto.description,
        dto.projectId,
      ),
    );
  }

  @Post('description')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate, improve, or shorten a task description' })
  async description(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateDescriptionDto,
  ) {
    return this.commandBus.execute(
      new GenerateDescriptionCommand(
        userId,
        dto.title,
        dto.mode,
        dto.currentDescription ?? dto.description,
        dto.projectId,
      ),
    );
  }

  @Post('summarize-comments')
  @HttpCode(200)
  @ApiOperation({ summary: "Summarize a task's comment thread" })
  async summarize(
    @CurrentUser('id') userId: string,
    @Body() dto: SummarizeCommentsDto,
  ) {
    return this.commandBus.execute(
      new SummarizeCommentsCommand(userId, dto.taskId),
    );
  }

  @Post('search-tasks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Natural-language task search within a project' })
  async searchTasks(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchTasksDto,
  ) {
    return this.commandBus.execute(
      new SearchTasksCommand(userId, dto.projectId, dto.query),
    );
  }

  @Post('generate-tasks')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate structured tasks with subtasks from prompt',
  })
  async generateTasks(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateTasksDto,
  ) {
    return this.commandBus.execute(
      new GenerateTasksCommand(
        userId,
        dto.projectId,
        dto.prompt,
        dto.count ?? 5,
      ),
    );
  }

  @Post('chat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Conversational project assistant chat' })
  async chat(@CurrentUser('id') userId: string, @Body() dto: ChatDto) {
    return this.commandBus.execute(
      new ChatCommand(userId, dto.message, dto.projectId, dto.history),
    );
  }

  @Post(['insights', 'project-insights'])
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate AI project health insights and next-best actions',
  })
  async projectInsights(
    @CurrentUser('id') userId: string,
    @Body() dto: ProjectInsightsDto,
  ) {
    return this.commandBus.execute(
      new GenerateProjectInsightsCommand(userId, dto.projectId),
    );
  }

  @Post('jobs')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Queue a background AI job (project-insights | generate-tasks); result arrives as ai:job:completed',
  })
  async enqueueJob(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAiJobDto,
  ) {
    return this.commandBus.execute(
      new EnqueueAiJobCommand(
        userId,
        dto.type,
        dto.projectId,
        dto.prompt,
        dto.count,
      ),
    );
  }

  @Post('automation/proposals')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Propose automated batch task changes from natural language',
  })
  async proposeTaskActions(
    @CurrentUser('id') userId: string,
    @Body() dto: ProposeTaskActionsDto,
  ) {
    return this.commandBus.execute(
      new ProposeTaskActionsCommand(userId, dto.projectId, dto.request),
    );
  }

  @Post('automation/proposals/:planId/apply')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve and apply task action proposals to the project',
  })
  async applyTaskActions(
    @CurrentUser('id') userId: string,
    @Param('planId') planId: string,
    @Body() dto: ApplyTaskActionsDto,
  ) {
    return this.commandBus.execute(
      new ApplyTaskActionsCommand(userId, planId, dto.actionIds),
    );
  }
}
