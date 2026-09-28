import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { DocumentExceptionFilter } from './document-exception.filter';
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
} from '../../application/errors/document.errors';

describe('DocumentExceptionFilter', () => {
  let filter: DocumentExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new DocumentExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    } as any;
  });

  it('maps DocumentNotFoundError to 404 NOT_FOUND', () => {
    filter.catch(new DocumentNotFoundError('Doc missing'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Doc missing',
      },
    });
  });

  it('maps DocumentForbiddenError to 403 FORBIDDEN', () => {
    filter.catch(new DocumentForbiddenError('Access denied'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    });
  });

  it('maps DocumentConflictError to 409 CONFLICT', () => {
    filter.catch(new DocumentConflictError('Stale version'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Stale version',
      },
    });
  });

  it('falls back to 500 INTERNAL_ERROR for unrecognized errors', () => {
    filter.catch(new Error('Unknown failure'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unknown failure',
      },
    });
  });
});
