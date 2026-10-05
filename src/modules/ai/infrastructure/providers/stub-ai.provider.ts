// src/modules/ai/infrastructure/providers/stub-ai.provider.ts
//
// Deterministic, network-free AI provider. Used when OPENAI_API_KEY is unset (dev without
// a key) and as the default in tests. It produces plausible, rule-based output so the
// endpoints work end-to-end without any external dependency.

import {
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

  async chat(input: {
    message: string;
    context?: {
      projectName?: string;
      projectDescription?: string;
      tasksSummary?: string;
      membersSummary?: string;
    };
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<string> {
    const msg = input.message.toLowerCase();
    const proj = input.context?.projectName ?? 'your project';

    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return `Hello! I'm CollabAI. How can I help you manage **${proj}** today? You can ask me to create tasks, update priorities, assign work, or brainstorm project ideas.`;
    }
    if (msg.includes('how are you')) {
      return `I'm doing great and ready to assist you with **${proj}**! What would you like to work on next?`;
    }
    if (
      msg.includes('summary') ||
      msg.includes('status') ||
      msg.includes('progress')
    ) {
      if (input.context?.tasksSummary) {
        return `### 📋 Project Overview for **${proj}**\n\n${input.context.tasksSummary}\n\nLet me know if you want to organize, prioritize, or assign any of these tasks!`;
      }
      return `Here to help track **${proj}**. Let me know what specific tasks or team members you'd like to check on.`;
    }
    if (msg.includes('help') || msg.includes('what can you do')) {
      return `I can help you:\n- **Manage tasks**: create, assign, change status/priority, and set due dates.\n- **Brainstorm**: generate structured task lists and breakdown complex goals.\n- **Search & Filter**: find specific tasks and filter your board.\n- **Collaborate**: post comments and summarize team discussions.\n\nYou can talk to me naturally (e.g. *"create a task for Sunday outing"*, *"set priority to high and assign it to Mengchheang"*), or use slash commands like \`/create\`, \`/task\`, and \`/filter\`.`;
    }
    return `I understand you're asking about "${input.message}". For **${proj}**, I can assist with planning, task updates, role assignments, and team coordination. How would you like to proceed?`;
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
