// DeepSeek Flash v4 AI provider — OpenAI-compatible API.
// DeepSeek's chat completions endpoint mirrors OpenAI's format, so we reuse the
// same prompt structure as OpenAiProvider but point the client at DeepSeek's base URL.

import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  GenerateDescriptionInput,
  IAiProvider,
  SuggestSubtasksInput,
  SummarizeCommentsInput,
  TaskSearchInterpretation,
} from '../../domain/services/ai-provider.interface';
import { StubAiProvider } from './stub-ai.provider';

export class DeepSeekProvider implements IAiProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  private readonly client: OpenAI;
  private readonly fallback = new StubAiProvider();

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  async suggestSubtasks(input: SuggestSubtasksInput): Promise<string[]> {
    try {
      const content = await this.complete(
        'You break work down into short, actionable subtasks. Reply ONLY with a JSON array of strings.',
        `Task: "${input.title}"\n${input.description ? `Details: ${input.description}\n` : ''}Return exactly ${input.count} subtasks.`,
      );
      const parsed = safeJsonArray(content);
      if (parsed) return parsed.slice(0, input.count);
    } catch (err) {
      this.warn('suggestSubtasks', err);
    }
    return this.fallback.suggestSubtasks(input);
  }

  async generateDescription(input: GenerateDescriptionInput): Promise<string> {
    try {
      const instruction =
        input.mode === 'improve'
          ? 'Improve the clarity and completeness of this task description.'
          : input.mode === 'shorten'
            ? 'Shorten this task description to one concise sentence.'
            : 'Write a clear task description.';
      const content = await this.complete(
        'You write concise, professional task descriptions. Reply with plain text only.',
        `${instruction}\nTitle: "${input.title}"\n${input.currentDescription ? `Current: ${input.currentDescription}` : ''}`,
      );
      if (content.trim()) return content.trim();
    } catch (err) {
      this.warn('generateDescription', err);
    }
    return this.fallback.generateDescription(input);
  }

  async summarizeComments(input: SummarizeCommentsInput): Promise<string> {
    try {
      const formatted = input.comments
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n');
      const content = await this.complete(
        'You summarize team discussion threads into clear, actionable bullet points.',
        `Task${input.taskTitle ? `: "${input.taskTitle}"` : ''}\n\nDiscussion:\n${formatted}\n\nProvide a concise summary with key decisions and action items.`,
      );
      if (content.trim()) return content.trim();
    } catch (err) {
      this.warn('summarizeComments', err);
    }
    return this.fallback.summarizeComments(input);
  }

  async interpretSearch(query: string): Promise<TaskSearchInterpretation> {
    try {
      const content = await this.complete(
        `You interpret natural-language task search queries and return JSON.
Available statuses: "todo", "in_progress", "done".
Available labels: any string (e.g., "urgent", "frontend", "backend").
Respond with ONLY a JSON object with optional keys: q, status, label, dueBefore (ISO date).`,
        `Search query: "${query}"`,
      );
      const parsed = safeJsonObject(content);
      if (parsed) {
        return {
          q: parsed.q as string | undefined,
          status: parsed.status as TaskSearchInterpretation['status'],
          label: parsed.label as string | undefined,
          dueBefore: parsed.dueBefore ? new Date(parsed.dueBefore as string) : undefined,
          raw: parsed,
        };
      }
    } catch (err) {
      this.warn('interpretSearch', err);
    }
    return this.fallback.interpretSearch(query);
  }

  private async complete(system: string, user: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    return res.choices[0]?.message?.content ?? '';
  }

  private warn(method: string, err: unknown): void {
    this.logger.warn(
      `DeepSeek ${method} failed — falling back to stub: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function safeJsonArray(raw: string): string[] | null {
  try {
    const trimmed = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    // parse failed
  }
  return null;
}

function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const trimmed = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // parse failed
  }
  return null;
}
