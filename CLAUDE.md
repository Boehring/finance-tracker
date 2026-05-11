# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance tracker for shared expenses ("gastos compartidos"). Users track expenses split among named people, view debt balances, and record settlements. No tests exist in this project.

## Commands

### Backend (`cd backend`)

```bash
npm run dev          # Start with ts-node-dev (hot reload)
npm run build        # Compile TypeScript → dist/
npm run start        # Run compiled output
npx prisma migrate dev --name <name>   # Create and apply a migration
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Visual DB browser
```

### Frontend (`cd frontend`)

```bash
npm run dev    # Start Vite dev server on :5173 (proxies /api → :3001)
npm run build  # Type-check + Vite build → dist/
```

### Required environment (backend `.env`)

```
DATABASE_URL="postgresql://user:pass@localhost:5432/finance_tracker?schema=public"
JWT_SECRET="secret"
PORT=3001
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880
```

## Architecture

### Backend

- **Entry point**: `backend/src/index.ts` — creates the Express app, exports the singleton `prisma` client (imported by all routes as `import { prisma } from '../index'`).
- **Auth**: JWT Bearer tokens. The `authenticate` middleware (`middleware/auth.ts`) attaches `req.userId` (string). All route files call `router.use(authenticate)` at the top.
- **Routes**: one file per resource in `src/routes/` — `auth`, `people`, `categories`, `expenses`, `debts`. No service layer; Prisma queries live directly in route handlers.
- **File uploads**: Multer writes to `UPLOAD_DIR`; files are served statically at `/uploads`. Attachment metadata is stored in the `Attachment` table.
- **Expense creation/update** uses `prisma.$transaction` to atomically write the expense and its `ExpenseParticipant` rows.

### Data model key points

- **User-scoping**: all resources are scoped to `userId`/`createdById`. Always filter by `req.userId` in queries.
- **ExpenseParticipant**: stores `share` (absolute amount), plus either `percentage` or `amount` depending on `splitType`. Percentages must sum to 100; amounts must sum to total.
- **Debt calculation**: computed on-the-fly in `GET /api/debts` by aggregating expense participants — there is no stored Debt table for current balances.
- **Settlements**: recorded as an `Expense` with `type: 'SETTLEMENT'` (not `EXPENSE`), which excludes them from debt calculations.

### Frontend

- **Proxy**: Vite proxies `/api/*` to `http://localhost:3001`, so the frontend uses `/api` as the base URL.
- **Auth flow**: `useAuth` hook (`src/hooks/useAuth.tsx`) manages the JWT in `localStorage` and sets `axios.defaults.headers.common['Authorization']`. Wraps the whole app via `AuthProvider`.
- **API client**: single Axios instance in `src/services/api.ts` with `baseURL: '/api'`.
- **Routing**: React Router v6 in `App.tsx`. All authenticated routes redirect to `/login` if `isAuthenticated` is false; auth routes redirect to `/` if already logged in.
- `CreateExpense.tsx` handles both creation (`/expenses/new`) and editing (`/expenses/:id/edit`) — check `useParams` for the id to distinguish them.
