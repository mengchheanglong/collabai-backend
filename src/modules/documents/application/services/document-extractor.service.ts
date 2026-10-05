// src/modules/documents/application/services/document-extractor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface ExtractedDocumentContent {
  text: string;
  pageCount?: number;
  wordCount: number;
}

@Injectable()
export class DocumentExtractorService {
  private readonly logger = new Logger(DocumentExtractorService.name);

  /**
   * Parse a data URL (e.g. data:application/pdf;base64,...) into a Buffer and MIME type.
   */
  parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) return null;
    try {
      const buffer = Buffer.from(match[2], 'base64');
      return { buffer, mimeType: match[1].toLowerCase() };
    } catch (err) {
      this.logger.warn(`Failed to decode base64 dataUrl: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Extracts textual content from a Buffer based on mimeType and/or filename.
   */
  async extractText(
    buffer: Buffer,
    mimeType?: string,
    filename?: string,
  ): Promise<ExtractedDocumentContent> {
    const ext = filename ? filename.split('.').pop()?.toLowerCase() : '';
    const mime = (mimeType || '').toLowerCase();

    // 1. PDF extraction
    if (ext === 'pdf' || mime === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: buffer });
        try {
          const textResult = await parser.getText();
          const text = (textResult.text || '').trim();
          return {
            text,
            pageCount: textResult.total,
            wordCount: text ? text.split(/\s+/).length : 0,
          };
        } finally {
          await parser.destroy().catch(() => {});
        }
      } catch (err) {
        this.logger.warn(`PDF parsing error for ${filename ?? 'file'}: ${(err as Error).message}`);
      }
    }

    // 2. DOCX Word Document extraction
    if (
      ext === 'docx' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = (result.value || '').trim();
        return {
          text,
          wordCount: text ? text.split(/\s+/).length : 0,
        };
      } catch (err) {
        this.logger.warn(`DOCX parsing error for ${filename ?? 'file'}: ${(err as Error).message}`);
      }
    }

    // 3. Plain text, Markdown, JSON, CSV, Log files
    if (
      ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'yaml', 'yml', 'xml'].includes(ext ?? '') ||
      mime.startsWith('text/') ||
      mime === 'application/json'
    ) {
      try {
        const text = buffer.toString('utf-8').trim();
        return {
          text,
          wordCount: text ? text.split(/\s+/).length : 0,
        };
      } catch (err) {
        this.logger.warn(`Text decoding error for ${filename ?? 'file'}: ${(err as Error).message}`);
      }
    }

    return { text: '', wordCount: 0 };
  }

  /**
   * Extracts textual content from an attachment object (using dataUrl or URL).
   */
  async extractFromAttachment(attachment: {
    dataUrl?: string;
    type?: string;
    mimeType?: string;
    name?: string;
  }): Promise<string> {
    if (!attachment) return '';

    if (attachment.dataUrl) {
      const parsed = this.parseDataUrl(attachment.dataUrl);
      if (parsed) {
        const res = await this.extractText(
          parsed.buffer,
          parsed.mimeType || attachment.type || attachment.mimeType,
          attachment.name,
        );
        return res.text;
      }
    }

    return '';
  }
}
