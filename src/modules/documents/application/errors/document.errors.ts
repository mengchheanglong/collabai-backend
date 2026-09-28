// src/modules/documents/application/errors/document.errors.ts
export class DocumentNotFoundError extends Error {
  constructor(message = 'Document not found') {
    super(message);
    this.name = 'DocumentNotFoundError';
  }
}

export class DocumentForbiddenError extends Error {
  constructor(message = 'You do not have access to this document or project') {
    super(message);
    this.name = 'DocumentForbiddenError';
  }
}
