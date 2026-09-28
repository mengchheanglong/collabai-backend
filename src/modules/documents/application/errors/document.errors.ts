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

export class DocumentConflictError extends Error {
  constructor(message = 'Document has been modified by another user. Please reload and try again.') {
    super(message);
    this.name = 'DocumentConflictError';
  }
}
