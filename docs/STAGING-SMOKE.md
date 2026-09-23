# Local staging smoke stack

This stack runs production Docker images against disposable PostgreSQL, Redis, LocalStack S3, and a SendGrid-compatible HTTP mock. It exercises the app end to end without using developer database credentials or delivering real email. AI is the deterministic fallback because no model key is passed to the stack.

From the repository root:

```sh
docker compose -f docker-compose.staging.yml up -d postgres redis localstack sendgrid-mock
docker compose -f docker-compose.staging.yml --profile setup run --build --rm migrate
docker compose -f docker-compose.staging.yml up --build -d backend frontend
docker compose -f docker-compose.staging.yml --profile smoke run --rm smoke
docker compose -f docker-compose.staging.yml down
```

Frontend is available at `http://localhost:4200`, backend at `http://localhost:14000/api/v1`, LocalStack at `http://localhost:14566`, and the mail mock at `http://localhost:18025`. The credentials and ports in this file are for an isolated local run only. Do not reuse them in a hosted deployment. No named volumes are configured, so `down` removes the smoke stack's ephemeral database and services.

Passing verifies app behavior against local service substitutes and proves that both production container images start and serve requests. It does not prove delivery through a real SendGrid account, access to a hosted AWS bucket, or responses from a real OpenAI/Anthropic model. Those require staging deployment secrets and real service endpoints.
