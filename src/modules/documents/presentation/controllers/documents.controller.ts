// src/modules/documents/presentation/controllers/documents.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { DocumentExceptionFilter } from '../exception-filters/document-exception.filter';
import { CreateDocumentCommand } from '../../application/commands/create-document.command';
import { UpdateDocumentCommand } from '../../application/commands/update-document.command';
import { DeleteDocumentCommand } from '../../application/commands/delete-document.command';
import { GetDocumentsQuery } from '../../application/queries/get-documents.query';
import { GetDocumentQuery } from '../../application/queries/get-document.query';
import { CreateDocumentDto } from '../../application/dtos/create-document.dto';
import { UpdateDocumentDto } from '../../application/dtos/update-document.dto';
import {
  toDocumentResponse,
  DocumentResponseDto,
} from '../../application/dtos/document-response.dto';
import { DocumentView } from '../../domain/repositories/document.repository.interface';

@ApiTags('Documents')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(DocumentExceptionFilter)
export class DocumentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(['projects/:projectId/docs', 'projects/:projectId/documents'])
  @ApiOperation({ summary: 'List all documents in a project' })
  async listDocuments(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<DocumentResponseDto[]> {
    const views: DocumentView[] = await this.queryBus.execute(
      new GetDocumentsQuery(userId, projectId),
    );
    return views.map(toDocumentResponse);
  }

  @Post(['projects/:projectId/docs', 'projects/:projectId/documents'])
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new document in a project' })
  async createDocument(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() dto: CreateDocumentDto,
  ): Promise<{ document: DocumentResponseDto }> {
    const view: DocumentView = await this.commandBus.execute(
      new CreateDocumentCommand(userId, projectId, dto.title, dto.content),
    );
    return { document: toDocumentResponse(view) };
  }

  @Get(['projects/:projectId/docs/:documentId', 'projects/:projectId/documents/:documentId'])
  @ApiOperation({ summary: 'Get a document by ID within a project' })
  async getProjectDocument(
    @CurrentUser('id') userId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ): Promise<{ document: DocumentResponseDto; canEdit: boolean }> {
    const view: DocumentView = await this.queryBus.execute(
      new GetDocumentQuery(userId, documentId),
    );
    return { document: toDocumentResponse(view), canEdit: true };
  }

  @Get(['docs/:documentId', 'documents/:documentId'])
  @ApiOperation({ summary: 'Get a document by ID' })
  async getDocument(
    @CurrentUser('id') userId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ): Promise<{ document: DocumentResponseDto; canEdit: boolean }> {
    const view: DocumentView = await this.queryBus.execute(
      new GetDocumentQuery(userId, documentId),
    );
    return { document: toDocumentResponse(view), canEdit: true };
  }

  @Patch([
    'projects/:projectId/docs/:documentId',
    'projects/:projectId/documents/:documentId',
    'docs/:documentId',
    'documents/:documentId',
  ])
  @ApiOperation({ summary: 'Update a document' })
  async updateDocument(
    @CurrentUser('id') userId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<{ document: DocumentResponseDto }> {
    const view: DocumentView = await this.commandBus.execute(
      new UpdateDocumentCommand(userId, documentId, {
        title: dto.title,
        content: dto.content,
      }),
    );
    return { document: toDocumentResponse(view) };
  }

  @Delete([
    'projects/:projectId/docs/:documentId',
    'projects/:projectId/documents/:documentId',
    'docs/:documentId',
    'documents/:documentId',
  ])
  @ApiOperation({ summary: 'Delete a document' })
  async deleteDocument(
    @CurrentUser('id') userId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.commandBus.execute(new DeleteDocumentCommand(userId, documentId));
    return { success: true, message: 'Document deleted successfully' };
  }
}
