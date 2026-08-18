// src/modules/ai/infrastructure/providers/stub-ai.provider.ts
//
// Deterministic, network-free AI provider. Used when OPENAI_API_KEY is unset (dev without
// a key) and as the default in tests. It produces plausible, rule-based output so the
// endpoints work end-to-end without any external dependency.

import {
  GenerateDescriptionInput,
  GenerateTasksInput,
  IAiProvider,
  StructuredTask,
  SuggestSubtasksInput,
  SummarizeCommentsInput,
  TaskSearchInterpretation,
} from '../../domain/services/ai-provider.interface';

export class StubAiProvider implements IAiProvider {
  async generateTasks(input: GenerateTasksInput): Promise<StructuredTask[]> {
    const count = Math.min(Math.max(input.count, 1), 15);
    const results: StructuredTask[] = [];
    for (let i = 1; i <= count; i++) {
      results.push({
        title: `Task ${i}: ${input.prompt.slice(0, 60)}`,
        description: `Execute part ${i} for "${input.prompt}": define objectives, methodology, and outcome measures.`,
        subtasks: [
          `Prepare materials and setup for phase ${i}`,
          `Execute step ${i} procedures`,
          `Record outcomes and observations`,
          `Review findings and finalize phase ${i}`,
        ],
        priority: i === 1 ? 'high' : 'medium',
        labels: ['plan', 'ai-generated'],
      });
    }
    return results;
  }
  async suggestSubtasks(input: SuggestSubtasksInput): Promise<string[]> {
    const base = [
      `Break down "${input.title}" into concrete steps`,
      `Draft the approach for ${input.title}`,
      `Implement the core of ${input.title}`,
      `Write tests for ${input.title}`,
      `Review and refine ${input.title}`,
      `Document ${input.title}`,
      `Verify ${input.title} end-to-end`,
    ];
    return base.slice(0, Math.min(input.count, base.length));
  }

  async generateDescription(input: GenerateDescriptionInput): Promise<string> {
    switch (input.mode) {
      case 'improve':
        return `${(input.currentDescription ?? '').trim()} (clarified: goals, acceptance criteria, and edge cases for "${input.title}".)`.trim();
      case 'shorten':
        return (input.currentDescription ?? input.title)
          .split('.')
          .slice(0, 1)
          .join('.')
          .trim();
      case 'generate':
      default:
        return `Complete "${input.title}": define the outcome, list the steps, and note acceptance criteria.`;
    }
  }

  async summarizeComments(input: SummarizeCommentsInput): Promise<string> {
    const n = input.comments.length;
    if (n === 0) return 'No comments to summarize yet.';
    const first = input.comments[0].slice(0, 140);
    return `Summary of ${n} comment${n === 1 ? '' : 's'}: ${first}${first.length >= 140 ? '…' : ''}`;
  }

  async interpretSearch(query: string): Promise<TaskSearchInterpretation> {
    const lower = query.toLowerCase();

    let status: TaskSearchInterpretation['status'];
    if (lower.includes('in progress') || lower.includes('in-progress')) {
      status = 'in_progress';
    } else if (lower.includes('done') || lower.includes('completed')) {
      status = 'done';
    } else if (lower.includes('todo') || lower.includes('to do')) {
      status = 'todo';
    }

    let dueBefore: Date | undefined;
    const now = new Date();
    if (lower.includes('today')) {
      dueBefore = endOfDay(now);
    } else if (lower.includes('tomorrow')) {
      dueBefore = endOfDay(addDays(now, 1));
    } else if (lower.includes('this week')) {
      dueBefore = endOfDay(addDays(now, 7));
    }

    // With no NL model, use the raw text as a title search unless a status was detected.
    const q = status ? undefined : query.trim() || undefined;

    return {
      q,
      status,
      dueBefore,
      raw: {
        originalQuery: query,
        detectedStatus: status ?? null,
        dueBefore: dueBefore ? dueBefore.toISOString() : null,
      },
    };
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
