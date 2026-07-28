// src/modules/ai/presentation/controllers/ai.controller.ts
//
// REST surface for AI features. All routes require a valid access token; project-scoped
// calls additionally require membership (enforced in handlers). The provider key lives
// server-side only. Errors -> AiExceptionFilter.

import {
  Body,
  Controller,
  HttpCode,
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

import {
  GenerateDescriptionDto,
  SearchTasksDto,
  SuggestSubtasksDto,
  SummarizeCommentsDto,
} from '../../application/dtos/ai.dto';

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
        dto.currentDescription,
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
}
