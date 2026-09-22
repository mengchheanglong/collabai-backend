# CollabAI Backend — Render Deployment Guide

This guide walks through deploying the **CollabAI Backend (NestJS + Prisma + PostgreSQL)** on [Render](https://render.com).

---

## Architecture on Render

- **Web Service**: Node.js 22 runtime running NestJS (`collabai-api.onrender.com`)
- **Database**: Managed PostgreSQL (`collabai-db`) or external (Supabase/Neon)
- **Port Binding**: Explicitly bound to `0.0.0.0:$PORT` (Render defaults to port 10000)
- **Health Check**: `GET /api/v1/health` (returns `{"success":true,"data":{"status":"ok","service":"collabai-api"}}`)
- **CORS & Cookies**: Configured for cross-origin credentials (`SameSite=None`, `Secure=true`)

---

## Option 1: Blueprint Deployment (Recommended & Fastest)

Render supports Infrastructure-as-Code blueprints via `render.yaml`.

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository (`mengchheanglong/collabai-backend`).
4. Render will automatically detect `render.yaml` and provision:
   - **PostgreSQL Database** (`collabai-db`)
   - **Web Service** (`collabai-api`) with auto-generated JWT secrets and connected database URL.
5. In the blueprint review page:
   - Enter your frontend URL in `FRONTEND_ORIGIN` (e.g. `https://collabai-web.onrender.com`).
   - (Optional) Enter your `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, or SMTP email credentials if using live providers.
6. Click **Apply**. Render will build, migrate the Prisma schema, and launch the API!

---

## Option 2: Manual Web Service Setup

If you prefer to configure manually via the Render UI:

### Step 1: Create a PostgreSQL Database
1. Click **New +** → **PostgreSQL**.
2. **Name**: `collabai-db`
3. **Database**: `collabai`
4. **User**: `collabai_user`
5. **Region**: Choose closest to your users (e.g. `Oregon (US West)` or `Singapore`).
6. **Plan**: `Free` (or `Starter` for persistent storage).
7. Click **Create Database**.
8. Copy the **Internal Database URL** (or External Database URL if hosting DB outside Render).

### Step 2: Create the Web Service
1. Click **New +** → **Web Service**.
2. Connect your repository `collabai-backend`.
3. Configure the settings:
   - **Name**: `collabai-api`
   - **Region**: Same region as your database.
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install && pnpm exec prisma generate && pnpm run build`
   - **Start Command**: `pnpm exec prisma db push --skip-generate && node dist/main.js`
   - **Plan**: `Free` (or `Starter`).
4. Under **Advanced Settings**:
   - **Health Check Path**: `/api/v1/health`

### Step 3: Add Environment Variables

In the **Environment** tab, add the following variables:

| Key | Value / Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | `production` |
| `DATABASE_URL` | Your PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Secret key (min 32 chars) | Random 32+ char string |
| `JWT_REFRESH_SECRET` | Refresh secret key (min 32 chars) | Random 32+ char string |
| `FRONTEND_ORIGIN` | Your frontend Render URL (comma-separated if multiple) | `https://collabai-web.onrender.com` |
| `COOKIE_SAME_SITE` | `none` (required for cross-domain cookie auth) | `none` |
| `COOKIE_SECURE` | `true` | `true` |
| `AI_PROVIDER` | `stub`, `deepseek`, or `openai` | `stub` (or `deepseek`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (if using DeepSeek) | `sk-...` |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI) | `sk-...` |
| `EMAIL_HOST` | SMTP server host (optional) | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP server port | `587` |
| `EMAIL_USER` | SMTP username / email | `you@gmail.com` |
| `EMAIL_PASS` | SMTP App Password | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | From header | `"CollabAI" <noreply@example.com>` |

5. Click **Deploy Web Service**.

---

## Verifying Deployment

Once deployed, you can verify your service:

1. **Health Check**:
   ```bash
   curl -I https://collabai-api.onrender.com/api/v1/health
   # Returns: HTTP/2 200 OK
   ```

2. **Swagger Documentation**:
   Open `https://collabai-api.onrender.com/api/docs` in your browser.

3. **Prisma Schema Sync**:
   The start command automatically runs `prisma db push --skip-generate` on every deploy, ensuring your PostgreSQL tables are always up to date.
