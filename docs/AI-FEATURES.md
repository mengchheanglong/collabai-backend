# CollabAI AI Features

AI provider options:

- OpenAI API.
- Groq API with Llama models.

For MVP, backend should expose simple AI endpoints. Frontend never uses provider keys directly.

## Environment variables

```txt
AI_PROVIDER=openai     # openai or groq
OPENAI_API_KEY=...
GROQ_API_KEY=...
AI_MODEL=gpt-4o-mini   # or llama-3.1-8b-instant etc.
AI_MAX_TOKENS=800
```

## AI endpoint priorities

1. `POST /ai/subtasks` — easiest and most demo-friendly.
2. `POST /ai/description` — improves task quality.
3. `POST /ai/summarize-comments` — useful collaboration feature.
4. `POST /ai/search-tasks` — optional if time is short.

## Prompt safety rules

- Keep prompts short and structured.
- Tell the model to return JSON only where possible.
- Validate model output before returning it to frontend.
- Enforce limits: maximum title/description/comment length.
- Do not send private tokens/secrets to AI provider.

## Feature 1: Subtask suggestion

Input:

```json
{
  "title": "Build login page",
  "description": "Angular login page connected to JWT backend",
  "count": 5
}
```

Prompt idea:

```txt
You are helping a software project team break a task into clear implementation subtasks.
Return JSON only: {"subtasks": ["..."]}
Task title: Build login page
Task description: Angular login page connected to JWT backend
Generate exactly 5 short actionable subtasks. Each subtask must start with a verb.
```

Backend should parse and return:

```json
{
  "subtasks": [
    "Create login route and page component",
    "Build email/password form with validation",
    "Connect form to auth service login method",
    "Store JWT token securely in frontend storage",
    "Redirect user to dashboard after login"
  ]
}
```

## Feature 2: Description generator/improver

Modes:

- `generate`: create description from title.
- `improve`: make existing description clearer.
- `shorten`: shorten long description.

Prompt idea:

```txt
Return JSON only: {"description":"..."}
Write a clear project-management task description for this task.
Title: {title}
Current description: {currentDescription}
Mode: {mode}
Keep it under 120 words. Include expected outcome and important constraints.
```

## Feature 3: Comment summarizer

Backend should fetch task comments, combine comment bodies with author names, then ask AI to summarize.

Prompt idea:

```txt
Return JSON only: {"summary":"..."}
Summarize these task comments for a teammate joining late.
Include decisions, blockers, and next action if present.
Keep under 100 words.
Comments:
- Dara: I started the login form.
- Sophea: Backend login is ready.
```

## Feature 4: Smart task search

MVP approach:

1. Ask AI to convert natural language query into filters.
2. Validate filters.
3. Run MongoDB query.

Example model output:

```json
{
  "labels": ["frontend"],
  "statusNot": ["done"],
  "dueRange": "this_week",
  "priority": null,
  "assigneeName": null,
  "text": null
}
```

Supported filters:

```ts
{
  text?: string;
  labels?: string[];
  status?: ('todo' | 'in_progress' | 'done')[];
  statusNot?: ('todo' | 'in_progress' | 'done')[];
  priority?: ('low' | 'medium' | 'high' | 'urgent')[];
  dueRange?: 'today' | 'this_week' | 'overdue' | null;
  assigneeId?: string | null;
}
```

Embedding-based semantic search is optional bonus. Do not block MVP on it.

## UI recommendations

- Task detail page: button `Generate subtasks`.
- Task description editor: button `AI improve`.
- Comments panel: button `Summarize discussion`.
- Dashboard/project board: smart search bar.

## Cost controls

- Add per-user simple rate limit for AI endpoints.
- Cache repeated subtask/description requests only if easy.
- Limit AI input size, especially comments.

