# CollabAI Backend Session Start

You are in the separate backend repo root:

```txt
.
```

Frontend folder:

```txt
../collabai-frontend
```

Canonical shared project folder:

```txt
../collabai
```

## First files to read

1. `AGENTS.md`
2. `docs/API-CONTRACT.md`
3. `docs/DATABASE-SCHEMA.md`
4. `docs/BACKEND-SPEC.md`
5. `docs/IMPLEMENTATION-CHECKLIST.md`

## Next action

Initialize the Node/Express backend and implement health + auth first.

```bash
npm init -y
npm install express mongoose jsonwebtoken bcryptjs cors dotenv helmet morgan zod socket.io openai
npm install -D typescript ts-node-dev @types/node @types/express @types/jsonwebtoken @types/bcryptjs
```
