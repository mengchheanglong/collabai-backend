// src/common/pipes/parse-uuid.pipe.ts
//
// Generic UUID validation pipe for route params (e.g. @Param('id', ParseUuidPipe)).
// Uses class-validator's isUUID so there's no extra dependency wiring. Reusable.

import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUUID(value)) {
      throw new BadRequestException(`Invalid UUID: ${value}`);
    }
    return value;
  }
}
