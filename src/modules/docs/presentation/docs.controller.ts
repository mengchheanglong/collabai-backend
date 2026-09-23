import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  ListDocumentsDto,
} from '../application/docs.dto';
import {
  CreateDocumentCommand,
  UpdateDocumentCommand,
  DeleteDocumentCommand,
  ListDocumentsQuery,
  GetDocumentQuery,
} from '../application/docs.handlers';
@Controller()
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}
  @Get('projects/:projectId/docs')
  list(
    @Param('projectId', ParseUUIDPipe) id: string,
    @CurrentUser('id') user: string,
    @Query() query: ListDocumentsDto,
  ) {
    return this.queries.execute(new ListDocumentsQuery(id, user, query));
  }
  @Post('projects/:projectId/docs')
  create(
    @Param('projectId', ParseUUIDPipe) id: string,
    @CurrentUser('id') user: string,
    @Body() input: CreateDocumentDto,
  ) {
    return this.commands.execute(new CreateDocumentCommand(id, user, input));
  }
  @Get('docs/:documentId')
  get(
    @Param('documentId', ParseUUIDPipe) id: string,
    @CurrentUser('id') user: string,
  ) {
    return this.queries.execute(new GetDocumentQuery(id, user));
  }
  @Patch('docs/:documentId')
  update(
    @Param('documentId', ParseUUIDPipe) id: string,
    @CurrentUser('id') user: string,
    @Body() input: UpdateDocumentDto,
  ) {
    return this.commands.execute(new UpdateDocumentCommand(id, user, input));
  }
  @Delete('docs/:documentId')
  remove(
    @Param('documentId', ParseUUIDPipe) id: string,
    @CurrentUser('id') user: string,
  ) {
    return this.commands.execute(new DeleteDocumentCommand(id, user));
  }
}
