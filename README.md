# CollabAI Backend

This is the separate backend workspace for CollabAI.

Shared/canonical project docs can live in a sibling folder if your team keeps one:

```txt
../collabai
```

This backend repo also contains its own `docs/` copy, so teammates can work from this repo alone.

Frontend workspace should be cloned as a sibling folder:

```txt
../collabai-frontend
```

## What this folder is for

Use this folder for the Express/MongoDB API only:

- Node.js + Express.
- TypeScript recommended.
- MongoDB/Mongoose.
- JWT + bcrypt auth.
- Socket.io server.
- OpenAI/Groq backend AI endpoints.

## Start here

1. Read `AGENTS.md`.
2. Read `.active/SESSION-START.md`.
3. Read `docs/API-CONTRACT.md` before creating/changing routes.
4. Read `docs/DATABASE-SCHEMA.md` before creating models.
5. Read `docs/BACKEND-SPEC.md` and `docs/IMPLEMENTATION-CHECKLIST.md`.

## API defaults

```txt
Backend API: http://localhost:4000/api/v1
Socket.io:   http://localhost:4000
MongoDB:     mongodb://127.0.0.1:27017/collabai
```

## Recommended backend setup

Run from this folder:

```bash
npm init -y
npm install express mongoose jsonwebtoken bcryptjs cors dotenv helmet morgan zod socket.io openai
npm install -D typescript ts-node-dev @types/node @types/express @types/jsonwebtoken @types/bcryptjs
```

## Integration rule

Do not change response shapes without updating `docs/API-CONTRACT.md` and telling frontend member.
