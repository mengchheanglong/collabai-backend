import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateDocumentDto {
  @Transform(trim) @IsString() @Length(1, 150) title!: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(100000)
  content?: string;
}
export class UpdateDocumentDto {
  @ValidateIf((_, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  title?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(100000)
  content?: string;
  @IsInt() @Min(1) version!: number;
}
export class ListDocumentsDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @ValidateIf((_, v) => v !== undefined) @IsString() @MaxLength(150) q?: string;
}
