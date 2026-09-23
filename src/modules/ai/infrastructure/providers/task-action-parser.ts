import type { ProposedTaskAction } from '../../domain/services/ai-provider.interface';

export function parseTaskActions(raw: string): ProposedTaskAction[] | null {
  const json = raw.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed.flatMap((value): ProposedTaskAction[] => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Record<string, unknown>;
      const changes = item.changes;
      if (!item.taskId || !item.rationale || !changes || typeof changes !== 'object') return [];
      return [{
        taskId: String(item.taskId),
        rationale: String(item.rationale).slice(0, 500),
        changes: changes as ProposedTaskAction['changes'],
      }];
    }).slice(0, 5);
  } catch {
    return null;
  }
}
