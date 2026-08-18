// src/modules/ai/infrastructure/providers/openai.provider.ts
//
// OpenAI-backed AI provider (server-side key only). Each method prompts the model and
// parses its response; on any failure it falls back to the deterministic StubAiProvider so
// an AI outage degrades gracefully rather than breaking the endpoint. The provider is
// swappable — nothing outside this file imports the vendor SDK.

import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  GenerateDescriptionInput,
  GenerateTasksInput,
  IAiProvider,
  StructuredTask,
  SuggestSubtasksInput,
  SummarizeCommentsInput,
  TaskSearchInterpretation,
} from '../../domain/services/ai-provider.interface';
import { StubAiProvider } from './stub-ai.provider';

export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly fallback = new StubAiProvider();

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async generateTasks(input: GenerateTasksInput): Promise<StructuredTask[]> {
    try {
      const content = await this.complete(
        'You are an expert project planner and researcher. Break down the request into comprehensive, structured tasks. Reply ONLY with a valid JSON array of objects with the exact schema: [{"title": string, "description": string, "subtasks": string[], "priority": "low"|"medium"|"high"|"urgent", "labels": string[]}]. Do NOT wrap with markdown fences.',
        `User Prompt / Requirement: "${input.prompt}"\nGenerate exactly ${input.count} distinct, comprehensive, and production-grade tasks. Each task MUST include a concise descriptive title, detailed structured description (e.g. purpose, methodology, outcome measures), 3-5 concrete actionable subtasks, appropriate priority, and relevant tags/labels.`,
      );
      const parsed = safeStructuredTasks(content);
      if (parsed && parsed.length > 0) return parsed.slice(0, input.count);
    } catch (err) {
      this.warn('generateTasks', err);
    }
    return this.fallback.generateTasks(input);
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
    if (input.comments.length === 0) {
      return this.fallback.summarizeComments(input);
    }
    try {
      const content = await this.complete(
        'You summarize task discussions into a short paragraph highlighting decisions and open items.',
        `${input.taskTitle ? `Task: ${input.taskTitle}\n` : ''}Comments:\n${input.comments
          .map((c, i) => `${i + 1}. ${c}`)
          .join('\n')}`,
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
        'Convert the user query into a JSON object with optional keys: ' +
          '"status" (todo|in_progress|done), "label" (string), "q" (free text), ' +
          '"dueBefore" (ISO date). Reply ONLY with JSON.',
        query,
      );
      const parsed = safeJsonObject(content);
      if (parsed) {
        const status = ['todo', 'in_progress', 'done'].includes(
          String(parsed.status),
        )
          ? (parsed.status as TaskSearchInterpretation['status'])
          : undefined;
        const dueBefore = parsed.dueBefore
          ? new Date(String(parsed.dueBefore))
          : undefined;
        return {
          status,
          label: typeof parsed.label === 'string' ? parsed.label : undefined,
          q: typeof parsed.q === 'string' ? parsed.q : undefined,
          dueBefore:
            dueBefore && !Number.isNaN(dueBefore.getTime())
              ? dueBefore
              : undefined,
          raw: parsed,
        };
      }
    } catch (err) {
      this.warn('interpretSearch', err);
    }
    return this.fallback.interpretSearch(query);
  }

  private async complete(system: string, user: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }

  private warn(op: string, err: unknown): void {
    this.logger.warn(
      `OpenAI ${op} failed, falling back to stub: ${(err as Error).message}`,
    );
  }
}

function safeJsonArray(text: string): string[] | null {
  const json = extractJson(text);
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v)).filter((v) => v.trim().length > 0);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function safeJsonObject(text: string): Record<string, unknown> | null {
  const json = extractJson(text);
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Pull the first JSON array/object out of a possibly-fenced model reply. */
function extractJson(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function safeStructuredTasks(text: string): StructuredTask[] | null {
  const json = extractJson(text);
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => ({
          title: String(item.title || item.name || 'Untitled Task').trim(),
          description: String(item.description || item.details || '').trim(),
          subtasks: Array.isArray(item.subtasks)
            ? item.subtasks.map((s: any) => String(s).trim()).filter(Boolean)
            : [],
          priority: ['low', 'medium', 'high', 'urgent'].includes(item.priority)
            ? item.priority
            : 'medium',
          labels: Array.isArray(item.labels)
            ? item.labels.map((l: any) => String(l).trim()).filter(Boolean)
            : [],
        }))
        .filter((t) => t.title.length > 0);
    }
  } catch {
    /* ignore */
  }
  return null;
}
