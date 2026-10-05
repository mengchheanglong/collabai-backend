// src/modules/ai/infrastructure/providers/stub-ai.provider.ts
//
// Deterministic, network-free AI provider. Used when OPENAI_API_KEY is unset (dev without
// a key) and as the default in tests. It produces plausible, rule-based output so the
// endpoints work end-to-end without any external dependency.

import {
  ChatInput,
  GenerateDescriptionInput,
  GenerateTasksInput,
  IAiProvider,
  NextBestAction,
  ProjectInsightsInput,
  ProjectInsightsOutput,
  ProposedAction,
  ProposeTaskActionsOutput,
  StructuredTask,
  SuggestSubtasksInput,
  SummarizeCommentsInput,
  TaskActionProposalInput,
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

  async chat(input: ChatInput): Promise<string> {
    const rawMsg = input.message.trim();
    const msg = rawMsg.toLowerCase();
    const proj = input.context?.projectName ?? 'your project';
    const docs = input.context?.documents ?? [];

    // Helper: determine if previous conversation was about documents
    const lastHistory =
      input.history && input.history.length > 0
        ? input.history[input.history.length - 1]
        : undefined;
    const historyWasAboutDocs =
      lastHistory &&
      (lastHistory.content.includes('📚 Project Documentation') ||
        lastHistory.content.includes('Document 1:') ||
        lastHistory.content.toLowerCase().includes('document') ||
        lastHistory.content.toLowerCase().includes('srs'));

    // Check if user specifically references a document by title or keyword
    const matchedDoc = docs.find((d) => {
      const titleLower = d.title.toLowerCase();
      if (msg.includes(titleLower)) return true;
      const words = titleLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      const matchedWords = words.filter((w) => msg.includes(w));
      return (
        matchedWords.length >= 2 ||
        (words.length === 1 && matchedWords.length === 1)
      );
    });

    const isDocKeyword =
      msg.includes('doc') ||
      msg.includes('documentation') ||
      msg.includes('spec') ||
      msg.includes('specification') ||
      msg.includes('srs') ||
      msg.includes('prd') ||
      msg.includes('guide') ||
      msg.includes('manual') ||
      msg.includes('requirement');

    const isReferringToDoc =
      Boolean(matchedDoc) ||
      (historyWasAboutDocs &&
        (msg.includes('it') ||
          msg.includes('this') ||
          msg.includes('summary') ||
          msg.includes('summarize') ||
          msg.includes('detail') ||
          msg.includes('explain'))) ||
      (isDocKeyword &&
        (msg.includes('summary') ||
          msg.includes('summarize') ||
          msg.includes('what') ||
          msg.includes('show') ||
          msg.includes('explain') ||
          msg.includes('about')));

    // 1. Greetings
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return `Hello! I'm CollabAI. How can I help you manage **${proj}** today? You can ask me to create tasks, update priorities, assign work, or explore project documentation.`;
    }
    if (msg.includes('how are you')) {
      return `I'm doing great and ready to assist you with **${proj}**! What would you like to work on next?`;
    }

    // 2. Document Summary / Document Queries (prioritized before generic task summary)
    if (isReferringToDoc) {
      const targetDoc = matchedDoc || docs[0];
      if (targetDoc) {
        return this.formatDocumentSummary(targetDoc, proj);
      }
      if (input.context?.documentsSummary) {
        return `### 📚 Project Documentation for **${proj}**\n\n${input.context.documentsSummary}\n\nLet me know if you would like me to explain any section, summarize key takeaways, or draft tasks based on this documentation!`;
      }
      return `No documentation found for **${proj}**. You can add guides, specs, or meeting notes in the Documentation tab!`;
    }

    // 3. What documents exist / listing documents
    if (
      isDocKeyword ||
      msg.includes('what is in our document') ||
      msg.includes('what documents')
    ) {
      if (input.context?.documentsSummary) {
        return `### 📚 Project Documentation for **${proj}**\n\n${input.context.documentsSummary}\n\nLet me know if you would like me to explain any section, summarize key takeaways, or draft tasks based on this documentation!`;
      }
      return `No documentation recorded yet for **${proj}**. You can upload PDFs, Word documents, or write markdown specs in the Documentation tab!`;
    }

    // 4. Project Overview / Task Summary (explicit task / status / board overview)
    if (
      msg.includes('summary') ||
      msg.includes('status') ||
      msg.includes('progress') ||
      msg.includes('overview')
    ) {
      if (input.context?.tasksSummary) {
        return `### 📋 Project Overview for **${proj}**\n\n${input.context.tasksSummary}\n\nLet me know if you want to organize, prioritize, or assign any of these tasks!`;
      }
      return `Here to help track **${proj}**. Let me know what specific tasks or team members you'd like to check on.`;
    }

    // 5. Help / capabilities
    if (msg.includes('help') || msg.includes('what can you do')) {
      return `I can help you:\n- **Manage tasks**: create, assign, change status/priority, and set due dates.\n- **Read & summarize documentation**: upload PDFs, specifications, and PRDs, and ask me to summarize or extract tasks.\n- **Brainstorm**: generate structured task lists and breakdown complex goals.\n- **Search & Filter**: find specific tasks and filter your board.\n- **Collaborate**: post comments and summarize team discussions.\n\nYou can talk to me naturally (e.g. *"create a task for Sunday outing"*, *"summarize our SRS document"*, *"set priority to high and assign it to Mengchheang"*), or use slash commands like \`/create\`, \`/task\`, and \`/filter\`.`;
    }

    return `I understand you're asking about "${input.message}". For **${proj}**, I can assist with planning, task updates, documentation analysis, and team coordination. How would you like to proceed?`;
  }

  private formatDocumentSummary(
    doc: { title: string; content: string; fileType?: string | null },
    proj: string,
  ): string {
    const rawContent = (doc.content || '').trim();
    const format = doc.fileType ? doc.fileType.toUpperCase() : 'DOCUMENT';

    if (!rawContent || rawContent.length < 50) {
      return `### 📄 Summary: "${doc.title}" [${format}]\n\nThis document currently has limited text content recorded.\n\n- **Document Title**: ${doc.title}\n- **Format**: ${format}\n\nLet me know if you would like to edit or add more content to this document!`;
    }

    const lines = rawContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const meaningfulLines = lines.filter(
      (l) =>
        !l.startsWith('#') ||
        l.replace(/^#+\s*/, '').toLowerCase() !== doc.title.toLowerCase(),
    );

    const introParagraphs: string[] = [];
    const bulletPoints: string[] = [];
    const sections: Array<{ title: string; items: string[] }> = [];
    let currentSection: { title: string; items: string[] } | null = null;

    for (let i = 0; i < meaningfulLines.length && i < 150; i++) {
      const line = meaningfulLines[i];
      if (/^(\d+\.|\d+\.\d+|#+|[A-Z\s]{4,}:)/.test(line) && line.length < 80) {
        if (currentSection && currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace(/^#+\s*/, ''), items: [] };
      } else if (/^[●•\-\*]\s*/.test(line)) {
        const cleanBullet = line.replace(/^[●•\-\*]\s*/, '').trim();
        if (currentSection) {
          currentSection.items.push(cleanBullet);
        } else {
          bulletPoints.push(cleanBullet);
        }
      } else if (line.length > 30) {
        if (currentSection) {
          if (currentSection.items.length < 4) {
            currentSection.items.push(line);
          }
        } else if (introParagraphs.length < 3) {
          introParagraphs.push(line);
        }
      }
    }
    if (currentSection && currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    const overview =
      introParagraphs.slice(0, 2).join(' ') ||
      meaningfulLines.slice(0, 3).join(' ') ||
      'Overview not explicitly specified.';

    const keyHighlights =
      bulletPoints.length > 0
        ? bulletPoints.slice(0, 5).map((b) => `- ${b}`).join('\n')
        : sections
            .slice(0, 4)
            .map(
              (s) =>
                `#### ${s.title}\n${s.items.slice(0, 3).map((item) => `- ${item}`).join('\n')}`,
            )
            .join('\n\n');

    return `### 📄 Summary of **${doc.title}** [${format}]

**Overview & Purpose:**
${overview}

${keyHighlights ? `**Key Requirements & Highlights:**\n${keyHighlights}\n\n` : ''}---
💡 *Would you like me to:*
- Break down any specific section or requirement?
- Draft executable project tasks based on this specification?
- Generate user stories or acceptance criteria?`;
  }

  async generateProjectInsights(
    input: ProjectInsightsInput,
  ): Promise<ProjectInsightsOutput> {
    const total = input.totalTasks || 0;
    const completed = input.completedTasks || 0;
    const overdue = input.overdueTasks?.length || 0;
    const inProgress = input.inProgressTasks || 0;

    let healthScore = 100;
    if (total > 0) {
      const completionRate = completed / total;
      const overduePenalty = (overdue / total) * 60;
      healthScore = Math.max(
        15,
        Math.min(100, Math.round(completionRate * 60 + 40 - overduePenalty)),
      );
    }

    const status: 'on_track' | 'at_risk' | 'off_track' =
      healthScore >= 75 ? 'on_track' : healthScore >= 50 ? 'at_risk' : 'off_track';

    const risks: string[] = [];
    if (overdue > 0) {
      risks.push(
        `${overdue} task${overdue > 1 ? 's are' : ' is'} past due date and require immediate intervention.`,
      );
    }
    if (total > 0 && inProgress > completed && inProgress > 5) {
      risks.push(
        `High work-in-progress (${inProgress} active tasks) may indicate bottlenecks or context switching.`,
      );
    }
    if (total === 0) {
      risks.push('No tasks defined in this project yet.');
    }
    if (risks.length === 0) {
      risks.push('No critical delivery risks detected at this time.');
    }

    const recommendations: string[] = [];
    if (overdue > 0) {
      recommendations.push(
        'Review and reschedule or reassign overdue items to unblock milestone progress.',
      );
    }
    if (input.todoTasks > 0 && inProgress === 0) {
      recommendations.push(
        'Pick up high-priority tasks from the backlog to kickstart active sprint momentum.',
      );
    }
    recommendations.push(
      'Maintain regular asynchronous updates and log progress on in-progress cards.',
    );

    const nextBestActions: NextBestAction[] = [];
    if (input.overdueTasks && input.overdueTasks.length > 0) {
      const topOverdue = input.overdueTasks[0];
      nextBestActions.push({
        title: `Resolve Overdue: "${topOverdue.title}"`,
        description: `Task is overdue (${topOverdue.priority} priority). Address blockers or adjust deadline.`,
        priority: 'urgent' as const,
        impact: 'Prevents downstream project milestone delays.',
      });
    }

    if (input.upcomingTasks && input.upcomingTasks.length > 0) {
      const nextUpcoming = input.upcomingTasks[0];
      nextBestActions.push({
        title: `Prepare: "${nextUpcoming.title}"`,
        description: `Upcoming task due soon. Ensure prerequisites and assignees are aligned.`,
        priority: 'high' as const,
        impact: 'Maintains steady delivery cadence without last-minute crunch.',
      });
    }

    if (nextBestActions.length === 0) {
      nextBestActions.push({
        title: 'Plan Next Sprint Milestones',
        description:
          'Break down upcoming project goals into bite-sized actionable user stories.',
        priority: 'medium' as const,
        impact: 'Ensures clear team alignment and pipeline visibility.',
      });
    }

    return {
      healthScore,
      status,
      summary: `Project "${input.projectName}" is currently ${status.replace('_', ' ')} with a health rating of ${healthScore}%. ${completed}/${total} tasks completed with ${overdue} overdue items.`,
      risks,
      recommendations,
      nextBestActions,
    };
  }

  async proposeTaskActions(
    input: TaskActionProposalInput,
  ): Promise<ProposeTaskActionsOutput> {
    const req = input.request.toLowerCase();
    const actions: ProposedAction[] = [];
    const tasks = input.tasks.filter((t) => t.status !== 'done');
    const targetTasks = tasks.length > 0 ? tasks : input.tasks;

    let targetMember = input.members[0];
    for (const m of input.members) {
      if (req.includes(m.name.toLowerCase())) {
        targetMember = m;
        break;
      }
    }

    const count = Math.min(Math.max(1, targetTasks.length), 3);
    for (let i = 0; i < count; i++) {
      const t = targetTasks[i];
      if (!t) continue;

      const changes: ProposedAction['changes'] = {};
      let rationale = `Action derived from requirement "${input.request.slice(0, 50)}"`;

      if (req.includes('urgent') || req.includes('priority')) {
        changes.priority = 'urgent';
        rationale = `Escalated priority to urgent based on user request.`;
      }
      if (req.includes('reassign') || req.includes('assign') || targetMember) {
        if (targetMember && targetMember.id !== t.assigneeId) {
          changes.assigneeId = targetMember.id;
          rationale += ` Reassigned to ${targetMember.name} to optimize sprint throughput.`;
        }
      }
      if (req.includes('done') || req.includes('complete')) {
        changes.status = 'done';
        rationale = `Marked as done per user instruction.`;
      } else if (req.includes('progress') || req.includes('start')) {
        changes.status = 'in_progress';
        rationale = `Moved to in-progress status.`;
      }

      if (Object.keys(changes).length === 0) {
        changes.priority = t.priority === 'urgent' ? 'high' : 'urgent';
        rationale = `Prioritized task to unblock dependent milestones.`;
      }

      actions.push({
        id: `action-${i + 1}`,
        taskId: t.id,
        taskTitle: t.title,
        rationale: rationale.trim(),
        previous: {
          status: t.status,
          priority: t.priority,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate ?? null,
        },
        changes,
      });
    }

    return { actions };
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
