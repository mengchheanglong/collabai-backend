// src/common/validation/validation.factory.spec.ts
import { ValidationError } from '@nestjs/common';
import {
  formatValidationErrors,
  validationExceptionFactory,
} from './validation.factory';
import { ContractErrorBody } from '../http/error-body';

describe('Validation Exception Factory & Error Formatter', () => {
  describe('formatValidationErrors', () => {
    it('should format simple field-level validation errors into details', () => {
      const errors: ValidationError[] = [
        {
          property: 'title',
          constraints: {
            isNotEmpty: 'title should not be empty',
            isString: 'title must be a string',
          },
        },
        {
          property: 'projectId',
          constraints: {
            isUuid: 'projectId must be a valid UUID',
          },
        },
      ];

      const details = formatValidationErrors(errors);
      expect(details).toEqual([
        { field: 'title', message: 'title should not be empty' },
        { field: 'title', message: 'title must be a string' },
        { field: 'projectId', message: 'projectId must be a valid UUID' },
      ]);
    });

    it('should recursively format deeply nested validation error trees (3+ levels)', () => {
      const errors: ValidationError[] = [
        {
          property: 'organization',
          children: [
            {
              property: 'department',
              children: [
                {
                  property: 'team',
                  children: [
                    {
                      property: 'leadEmail',
                      constraints: {
                        isEmail: 'leadEmail must be an email',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const details = formatValidationErrors(errors);
      expect(details).toEqual([
        {
          field: 'organization.department.team.leadEmail',
          message: 'leadEmail must be an email',
        },
      ]);
    });

    it('should format array element validation errors using bracket notation (e.g. items[0].id)', () => {
      const errors: ValidationError[] = [
        {
          property: 'items',
          children: [
            {
              property: '0',
              children: [
                {
                  property: 'id',
                  constraints: {
                    isUuid: 'id must be a UUID',
                  },
                },
                {
                  property: 'quantity',
                  constraints: {
                    min: 'quantity must not be less than 1',
                  },
                },
              ],
            },
            {
              property: '1',
              children: [
                {
                  property: 'name',
                  constraints: {
                    isNotEmpty: 'name should not be empty',
                  },
                },
              ],
            },
          ],
        },
      ];

      const details = formatValidationErrors(errors);
      expect(details).toEqual([
        { field: 'items[0].id', message: 'id must be a UUID' },
        {
          field: 'items[0].quantity',
          message: 'quantity must not be less than 1',
        },
        { field: 'items[1].name', message: 'name should not be empty' },
      ]);
    });

    it('should format multi-dimensional nested array errors correctly (matrix[0][1].val)', () => {
      const errors: ValidationError[] = [
        {
          property: 'matrix',
          children: [
            {
              property: '0',
              children: [
                {
                  property: '1',
                  children: [
                    {
                      property: 'val',
                      constraints: {
                        isNumber: 'val must be a number',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const details = formatValidationErrors(errors);
      expect(details).toEqual([
        { field: 'matrix[0][1].val', message: 'val must be a number' },
      ]);
    });

    it('should safely handle empty constraint maps or intermediate nodes with no constraints', () => {
      const errors: ValidationError[] = [
        {
          property: 'user',
          constraints: {},
          children: [
            {
              property: 'profile',
              children: [
                {
                  property: 'bio',
                  constraints: {
                    maxLength: 'bio is too long',
                  },
                },
              ],
            },
          ],
        },
      ];

      const details = formatValidationErrors(errors);
      expect(details).toEqual([
        { field: 'user.profile.bio', message: 'bio is too long' },
      ]);
    });

    it('should return an empty array when given empty, null, or undefined errors', () => {
      expect(formatValidationErrors([])).toEqual([]);
      expect(
        formatValidationErrors(null as unknown as ValidationError[]),
      ).toEqual([]);
      expect(
        formatValidationErrors(undefined as unknown as ValidationError[]),
      ).toEqual([]);
    });
  });

  describe('validationExceptionFactory', () => {
    it('should produce a BadRequestException with code VALIDATION_ERROR and singular message for 1 field', () => {
      const errors: ValidationError[] = [
        {
          property: 'title',
          constraints: {
            isTrimmedNotEmpty:
              'title should not be empty or contain only whitespace',
          },
        },
      ];

      const exception = validationExceptionFactory(errors);
      const response = exception.getResponse() as ContractErrorBody['error'];

      expect(exception.getStatus()).toBe(400);
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Validation failed on 1 field');
      expect(response.details).toEqual([
        {
          field: 'title',
          message: 'title should not be empty or contain only whitespace',
        },
      ]);
    });

    it('should produce plural message for multiple validation error fields', () => {
      const errors: ValidationError[] = [
        {
          property: 'title',
          constraints: { isNotEmpty: 'title is required' },
        },
        {
          property: 'dueDate',
          constraints: { isSafeDate: 'dueDate is invalid' },
        },
      ];

      const exception = validationExceptionFactory(errors);
      const response = exception.getResponse() as ContractErrorBody['error'];

      expect(response.message).toBe('Validation failed on 2 fields');
      expect(response.details).toHaveLength(2);
    });

    it('should handle empty error array gracefully', () => {
      const exception = validationExceptionFactory([]);
      const response = exception.getResponse() as ContractErrorBody['error'];

      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Validation failed on 0 fields');
      expect(response.details).toEqual([]);
    });
  });
});
