// src/modules/ai/infrastructure/providers/stub-ai.provider.spec.ts
import { StubAiProvider } from './stub-ai.provider';

describe('StubAiProvider', () => {
  const provider = new StubAiProvider();

  it('returns exactly `count` subtasks', async () => {
    const out = await provider.suggestSubtasks({ title: 'Build X', count: 4 });
    expect(out).toHaveLength(4);
    expect(out.every((s) => s.includes('Build X'))).toBe(true);
  });

  it('generate mode returns a description referencing the title', async () => {
    const out = await provider.generateDescription({
      title: 'Build X',
      mode: 'generate',
    });
    expect(out).toContain('Build X');
  });

  it('summarize handles an empty thread', async () => {
    expect(await provider.summarizeComments({ comments: [] })).toMatch(
      /no comments/i,
    );
  });

  describe('interpretSearch', () => {
    it('detects a done status and does not set q', async () => {
      const i = await provider.interpretSearch('show me completed tasks');
      expect(i.status).toBe('done');
      expect(i.q).toBeUndefined();
    });

    it('detects in_progress', async () => {
      const i = await provider.interpretSearch('what is in progress');
      expect(i.status).toBe('in_progress');
    });

    it('sets dueBefore for "this week"', async () => {
      const i = await provider.interpretSearch('tasks due this week');
      expect(i.dueBefore).toBeInstanceOf(Date);
    });

    it('falls back to text search when no keywords match', async () => {
      const i = await provider.interpretSearch('login page');
      expect(i.status).toBeUndefined();
      expect(i.q).toBe('login page');
    });
  });
});
