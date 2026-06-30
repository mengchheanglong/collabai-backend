# CollabAI Project Spec

## One-liner

CollabAI is a smart team task management app that combines Kanban boards with AI features to help teams work more efficiently.

## Product summary

CollabAI helps teams create projects, manage boards/tasks, collaborate in real time, and use AI to generate subtasks, improve task descriptions, summarize comments, and search tasks naturally.

## Target users

- Student teams working on class projects.
- Small hackathon teams.
- Junior developers building a portfolio project.
- Small internal teams that want Trello-like task tracking with AI assistance.

## MVP goals

By the end of 4 weeks, the app should support:

1. User registration/login/logout.
2. Dashboard with project overview.
3. CRUD for projects and boards.
4. Kanban task management with statuses: `todo`, `in_progress`, `done`.
5. Task assignment, due dates, labels, priorities.
6. Task comments.
7. AI subtask suggestions and description/summarization tools.
8. Drag-and-drop Kanban board.
9. Real-time updates for project teammates.
10. Activity log and simple analytics.
11. Responsive UI and dark mode.

## Non-goals for MVP

Avoid these until core MVP is stable:

- Complex organization billing.
- Deep permissions matrix beyond project owner/admin/member/viewer.
- Full-text vector database infrastructure.
- File attachments.
- Calendar sync.
- Mobile native app.

## Team role split

| Member | Primary focus | Responsibilities |
|---|---|---|
| 1 | Backend Lead | Express APIs, auth, Mongoose models, Socket.io, AI backend endpoints |
| 2 | Frontend Lead | Angular architecture, routing, Kanban UI, services, Angular Material |
| 3 | Full-stack Features | Task CRUD, comments, AI UI/backend integration |
| 4 | Polish + DevOps + Testing | Responsive design, real-time testing, activity log, deployment, docs |

## Suggested 4-week timeline

### Week 1 — Foundation

- Create frontend and backend apps.
- Auth register/login/me/logout.
- JWT protected routes.
- Project model and project dashboard.
- Basic project CRUD.

### Week 2 — Task management

- Board model.
- Task CRUD.
- Kanban board columns.
- Drag-and-drop status updates.
- Task details modal/page.
- Comments.

### Week 3 — AI + real-time

- AI subtask suggestion endpoint and UI.
- AI description generator/summarizer.
- Simple smart search.
- Socket.io project rooms.
- Live task/comment/project updates.

### Week 4 — polish/deploy

- Activity log.
- Notifications.
- Analytics dashboard.
- Responsive design and dark mode.
- Error states, loading states, empty states.
- Deployment and documentation.

## Success criteria

- A new user can register, login, create a project, create a board, create tasks, move tasks, comment, and see updates.
- Two browser windows logged in as project members see live task updates.
- AI generates useful subtasks for a task title.
- Frontend and backend agree with `docs/02-API-CONTRACT.md`.
- App can be demoed with seeded data in less than 5 minutes.

