# CollabAI Backend Agent Instructions

You are working only on the CollabAI Express/MongoDB backend.

## Read order

1. `README.md`
2. `.active/SESSION-START.md`
3. `docs/API-CONTRACT.md`
4. `docs/DATABASE-SCHEMA.md`
5. `docs/BACKEND-SPEC.md`
6. `docs/IMPLEMENTATION-CHECKLIST.md`
7. If touching Socket.io: `docs/REALTIME-SOCKET-CONTRACT.md`
8. If touching AI endpoints: `docs/AI-FEATURES.md`

## Rules

- All REST endpoints mount under `/api/v1`.
- All protected endpoints require JWT bearer auth.
- Never return `passwordHash`.
- Validate every request body.
- Verify project membership for every project/board/task/comment resource.
- Mutations happen through REST; Socket.io broadcasts after DB write succeeds.
- Frontend never calls AI provider directly; expose `/ai/*` endpoints.
- Keep API response envelope exactly as documented.

## Main implementation order

1. Setup Express/TypeScript/MongoDB.
2. Add health endpoint.
3. Implement auth.
4. Implement project + board CRUD.
5. Implement task + comment CRUD.
6. Implement activity + analytics.
7. Implement AI endpoints.
8. Implement Socket.io broadcasts.
9. Deploy.
