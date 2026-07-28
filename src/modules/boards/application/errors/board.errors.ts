// src/modules/boards/application/errors/board.errors.ts

export class BoardNotFoundError extends Error {
  constructor() {
    super('Board not found');
    this.name = 'BoardNotFoundError';
  }
}

export class BoardForbiddenError extends Error {
  constructor() {
    super('You do not have permission to perform this action on the board');
    this.name = 'BoardForbiddenError';
  }
}

export class DuplicateBoardNameError extends Error {
  constructor() {
    super('A board with this name already exists in the project');
    this.name = 'DuplicateBoardNameError';
  }
}
