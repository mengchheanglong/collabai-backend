# CollabAI system architecture

The technology baseline and deferred technologies are maintained in [TECH-SCOPE.md](TECH-SCOPE.md).

```text
Angular 21 browser client
  ├─ REST /api/v1 + JWT ───────► NestJS 11 (Express adapter)
  ├─ Socket.IO ────────────────► Realtime gateway
  └─ presigned PUT ────────────► Private S3 bucket

NestJS modules
  ├─ CQRS handlers / domain services
  ├─ Prisma ───────────────────► PostgreSQL
  ├─ in-process EventEmitter2 ─► notification/realtime handlers
  ├─ SendGrid ─────────────────► verification, reset, invitation mail
  ├─ OpenAI / DeepSeek / Claude ► AI provider adapter
  ├─ S3 presigning ────────────► private attachments and avatar objects
  └─ Sentry + JSON stdout logs
```

## Request flow

1. Nest controllers validate DTOs and require JWT authentication on protected routes.
2. CQRS handlers enforce project membership/role rules and execute Prisma reads/writes.
3. Domain events stay in-process; Socket.IO broadcasts after a successful database write.
4. The response interceptor applies the API envelope. The global exception filter normalizes errors and reports server errors to Sentry when configured.
5. Structured request logs are written to stdout for the deployment log collector.

## Deployment notes

- Run Prisma migrations before starting the backend container.
- The frontend container serves the Angular production build from Nginx with SPA route fallback.
- S3 uses the AWS SDK credential provider chain; production should use an IAM role. Configure bucket CORS for the frontend origin. Private attachments are downloaded using project-checked short-lived URLs.
- RabbitMQ is explicitly deferred; no async queue consumer currently requires a broker.
