import {
  CommandHandler,
  ICommandHandler,
  QueryHandler,
  IQueryHandler,
} from '@nestjs/cqrs';
import { DocsService } from './docs.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  ListDocumentsDto,
} from './docs.dto';
export class CreateDocumentCommand {
  constructor(
    public projectId: string,
    public userId: string,
    public input: CreateDocumentDto,
  ) {}
}
export class UpdateDocumentCommand {
  constructor(
    public id: string,
    public userId: string,
    public input: UpdateDocumentDto,
  ) {}
}
export class DeleteDocumentCommand {
  constructor(
    public id: string,
    public userId: string,
  ) {}
}
export class ListDocumentsQuery {
  constructor(
    public projectId: string,
    public userId: string,
    public query: ListDocumentsDto,
  ) {}
}
export class GetDocumentQuery {
  constructor(
    public id: string,
    public userId: string,
  ) {}
}
@CommandHandler(CreateDocumentCommand)
export class CreateDocumentHandler implements ICommandHandler<CreateDocumentCommand> {
  constructor(private readonly docs: DocsService) {}
  execute(c: CreateDocumentCommand) {
    return this.docs.create(c.projectId, c.userId, c.input);
  }
}
@CommandHandler(UpdateDocumentCommand)
export class UpdateDocumentHandler implements ICommandHandler<UpdateDocumentCommand> {
  constructor(private readonly docs: DocsService) {}
  execute(c: UpdateDocumentCommand) {
    return this.docs.update(c.id, c.userId, c.input);
  }
}
@CommandHandler(DeleteDocumentCommand)
export class DeleteDocumentHandler implements ICommandHandler<DeleteDocumentCommand> {
  constructor(private readonly docs: DocsService) {}
  execute(c: DeleteDocumentCommand) {
    return this.docs.remove(c.id, c.userId);
  }
}
@QueryHandler(ListDocumentsQuery)
export class ListDocumentsHandler implements IQueryHandler<ListDocumentsQuery> {
  constructor(private readonly docs: DocsService) {}
  execute(c: ListDocumentsQuery) {
    return this.docs.list(c.projectId, c.userId, c.query);
  }
}
@QueryHandler(GetDocumentQuery)
export class GetDocumentHandler implements IQueryHandler<GetDocumentQuery> {
  constructor(private readonly docs: DocsService) {}
  execute(c: GetDocumentQuery) {
    return this.docs.get(c.id, c.userId);
  }
}
export const DocsHandlers = [
  CreateDocumentHandler,
  UpdateDocumentHandler,
  DeleteDocumentHandler,
  ListDocumentsHandler,
  GetDocumentHandler,
];
