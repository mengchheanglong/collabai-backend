# CollabAI approved technology scope

This file is the approved technology baseline for the current product. The extracted SRS and early planning docs remain historical source material where their stack assumptions differ.

## Approved stack

- **Backend:** Node.js 22, NestJS 11 using its Express adapter, TypeScript, REST under `/api/v1`.
- **Data:** PostgreSQL with Prisma ORM and migrations.
- **Frontend:** Angular 21, TypeScript, Angular Material, SCSS, signals, and reactive forms.
- **Realtime/cache:** Socket.IO. Redis is optional for token blacklist and rate-limit state.
- **AI:** OpenAI, DeepSeek, and Anthropic Claude are selectable providers; keys stay on the backend. `AI_PROVIDER` chooses the provider, and `.env.example` selects DeepSeek. If the setting is unset or unrecognized, the backend selects OpenAI when its key is configured, otherwise the deterministic stub. If DeepSeek or Anthropic is selected without its key, selection falls through to configured OpenAI, then to the stub if OpenAI is also unavailable. A provider request or response-parsing failure falls back to the deterministic stub, not to another LLM. There is no automatic OpenAI-to-Anthropic or Anthropic-to-OpenAI failover.
- **Email:** SendGrid API for verification, password reset, and project invitations.
- **Uploads:** private S3 buckets with short-lived presigned PUT/GET URLs. Avatar display can use a CloudFront public base URL; attachments require project membership to obtain a download URL.
- **Observability:** optional `@sentry/nestjs` error reporting plus structured JSON request logs on stdout. A deployment collector (for example, CloudWatch Logs) owns log retention and querying.
- **Packaging:** multi-stage Docker images for the API and static Angular/Nginx frontend.
- **CI:** GitHub Actions runs lint, typecheck, tests, and production builds on pull requests.

## Workspace boundary

For this product, each **project is a workspace**. Its members share that project's boards, tasks, documents, and collaboration. There is no parent organization/workspace that groups multiple projects under one shared team or membership list. Cross-project organizations and memberships are outside the current scope.

## Deferred and excluded technologies

- **RabbitMQ:** deferred for the current release. Nest's in-process event emitter is sufficient for current domain events. Reconsider a broker if durable, retryable background jobs (such as queued email or AI work) or independent consumers become a requirement.
- **Fastify:** the API uses Nest's Express adapter. No Fastify migration is planned.
- **React/Vite/Zustand/TanStack/Tailwind/RHF:** the shipped client is Angular; no rewrite to these alternatives is planned.
- **CloudFront as a required runtime dependency:** only the public avatar URL setting needs a CDN. Private attachment downloads use short-lived S3 URLs.
- **CloudWatch SDK in application code:** deployments can ship structured stdout logs to CloudWatch or another collector without coupling business code to AWS logging APIs.

## Runtime configuration

See `../.env.example` for backend variables. Production deployments should provide database, JWT, email, and AI secrets through a secret manager; use an IAM task role for S3 instead of static AWS keys. Configure S3 CORS to allow the frontend origin to `PUT` signed uploads and configure bucket/CDN policies separately from application code.

Database rollout: run `npx prisma migrate deploy` and `npx prisma generate` before starting the new backend image. CI validates migrations against PostgreSQL.
