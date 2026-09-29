// src/common/filters/all-exceptions.filter.spec.ts
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'POST',
      url: '/api/v1/tasks',
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as unknown as Response,
        getRequest: () => mockRequest as Request,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle standard HttpException with string response', () => {
    const exception = new NotFoundException('Task not found');
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Task not found',
      },
    });
  });

  it('should handle HttpException with structured details array', () => {
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed on 1 field',
      details: [{ field: 'title', message: 'title is required' }],
    });
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed on 1 field',
        details: [{ field: 'title', message: 'title is required' }],
      },
    });
  });

  it('should format raw class-validator array messages into details', () => {
    const exception = new BadRequestException({
      message: ['title must not be empty', 'dueDate must be a safe date'],
    });
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          { message: 'title must not be empty' },
          { message: 'dueDate must be a safe date' },
        ],
      },
    });
  });

  it('should map Prisma P2023 error to 400 Bad Request', () => {
    const error = new Error('Invalid UUID') as Error & { code: string };
    error.code = 'P2023';
    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid UUID format provided',
      },
    });
  });

  it('should map Prisma P2025 error to 404 Not Found', () => {
    const error = new Error('Record to update not found') as Error & {
      code: string;
    };
    error.code = 'P2025';
    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  it('should map Prisma P2002 error to 409 Conflict', () => {
    const error = new Error('Unique constraint failed') as Error & {
      code: string;
    };
    error.code = 'P2002';
    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Unique constraint violation',
      },
    });
  });

  it('should map Prisma P2003 error to 400 Bad Request', () => {
    const error = new Error('Foreign key constraint failed') as Error & {
      code: string;
    };
    error.code = 'P2003';
    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Foreign key constraint violation',
      },
    });
  });

  it('should handle unhandled Error with 500 status', () => {
    const error = new Error('Unexpected database failure');
    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected database failure',
      },
    });
  });

  it('should handle non-Error thrown objects with fallback 500 error', () => {
    filter.catch('Unexpected string exception', mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });
});
