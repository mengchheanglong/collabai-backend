// DeepSeek Flash v4 AI provider — OpenAI-compatible API.
// DeepSeek's chat completions endpoint mirrors OpenAI's format, so we reuse the
// same prompt structure as OpenAiProvider but point the client at DeepSeek's base URL.

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

export class DeepSeekProvider implements IAiProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  private readonly client: OpenAI;
  private readonly fallback = new StubAiProvider();

  private readonly modelName: string;

  constructor(
    apiKey: string,
    model: string,
  ) {
    this.modelName = (!model || model.includes('deepseek-v4')) ? 'deepseek-chat' : model;
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  async generateTasks(input: GenerateTasksInput): Promise<StructuredTask[]> {
    try {
      const content = await this.complete(
        'You are an expert project planner. You break down user requirements into distinct, structured tasks. Reply ONLY with a valid JSON array of objects with keys: "title" (concise task title), "description" (1-2 sentences of objective and instructions), "subtasks" (array of 2-4 short actionable strings), "priority" ("low"|"medium"|"high"|"urgent"), "labels" (array of 1-3 lowercase string tags). Do not use markdown backticks or explanations.',
        `Request: "${input.prompt}"\nGenerate exactly ${input.count} distinct, production-grade tasks for this requirement.`,
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
        'You break work down into short, actionable subtasks or task items. Reply ONLY with a JSON array of strings, without backticks or markdown fences.',
        `Topic: "${input.title}"\n${input.description ? `Details: ${input.description}\n` : ''}Return exactly ${input.count} distinct, actionable items.`,
      );
      const parsed = safeJsonArray(content);
      if (parsed && parsed.length > 0) return parsed.slice(0, input.count);
    } catch (err) {
      this.warn('suggestSubtasks', err);
    }
    return this.fallback.suggestSubtasks(input);
  }

  async generateDescription(input: GenerateDescriptionInput): Promise<string> {
    try {
      const instruction =
        input.mode === 'improve'
          ? 'Improve the clarity, detail, and structure of this task description.'
          : input.mode === 'shorten'
            ? 'Shorten this task description into a concise summary.'
            : 'Write a clear, thorough, and professional task description with objective, key details, and acceptance criteria.';
      const content = await this.complete(
        'You write comprehensive, professional task descriptions. Format cleanly with clear sections or bullet points.',
        `${instruction}\nTitle: "${input.title}"\n${input.currentDescription ? `Context / Prompt: ${input.currentDescription}` : ''}`,
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
          dueBefore: parsed.dueBefore
            ? new Date(parsed.dueBefore as string)
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
    const res = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 4096,
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
    const trimmed = raw
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    const parsed = JSON.parse(trimmed);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return parsed;
    }
  } catch {
    // parse failed
  }
  return null;
}

function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const trimmed = raw
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    const parsed = JSON.parse(trimmed);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch {
    // parse failed
  }
  return null;
}

function safeStructuredTasks(raw: string): StructuredTask[] | null {
  try {
    const trimmed = raw
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item: any) => ({
            title: String(item.title || item.name || '').trim(),
            description: String(item.description || item.details || '').trim(),
            subtasks: Array.isArray(item.subtasks)
              ? item.subtasks.map((s: any) => String(s).trim()).filter(Boolean)
              : [],
            status: ['todo', 'in_progress', 'done'].includes(item.status)
              ? item.status
              : 'todo',
            priority: ['low', 'medium', 'high', 'urgent'].includes(item.priority)
              ? item.priority
              : 'medium',
            labels: Array.isArray(item.labels)
              ? item.labels.map((l: any) => String(l).trim()).filter(Boolean)
              : [],
            dueDate: typeof item.dueDate === 'string' ? item.dueDate : undefined,
          }))
          .filter((t) => t.title.length > 0);
      }
    } catch {
      const matchArray = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (matchArray) {
        const innerParsed = JSON.parse(matchArray[0]);
        if (Array.isArray(innerParsed) && innerParsed.length > 0) {
          return innerParsed
            .map((item: any) => ({
              title: String(item.title || item.name || '').trim(),
              description: String(item.description || item.details || '').trim(),
              subtasks: Array.isArray(item.subtasks)
                ? item.subtasks.map((s: any) => String(s).trim()).filter(Boolean)
                : [],
              status: ['todo', 'in_progress', 'done'].includes(item.status)
                ? item.status
                : 'todo',
              priority: ['low', 'medium', 'high', 'urgent'].includes(item.priority)
                ? item.priority
                : 'medium',
              labels: Array.isArray(item.labels)
                ? item.labels.map((l: any) => String(l).trim()).filter(Boolean)
                : [],
              dueDate: typeof item.dueDate === 'string' ? item.dueDate : undefined,
            }))
            .filter((t) => t.title.length > 0);
        }
      }
    }
  } catch {
    // parse failed
  }
  return null;
}
