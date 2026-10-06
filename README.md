# CAMPUS LIFE

A multiplayer university life-simulation game. Next.js (App Router) + TypeScript + Tailwind + Framer Motion, with Supabase (PostgreSQL + Auth).

## Status

Stage 1 (foundation): X and Google login for players, X-only admin login, OWNER / SUPER_ADMIN / ADMIN / MODERATOR roles, staff invites and management, audit log, admin session limits, rate limiting, security headers.

## Run it on your computer

1. Install Node.js 22 LTS and Git.
2. npm install
3. Copy .env.example to .env.local and fill in the values (see below).
4. Run the SQL files in supabase/migrations in order, using the Supabase SQL Editor.
5. npm run dev, then open http://localhost:3000

## Settings (.env.local, never commit this file)

- NEXT_PUBLIC_SITE_URL: http://localhost:3000 while developing
- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (no path at the end)
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase publishable key
- SUPABASE_SERVICE_ROLE_KEY: Supabase secret key. Server only.
- ADMIN_SESSION_SECRET: random 64-character hex string. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
- OWNER_X_USER_ID: the owner's numeric X account ID (not the username)

X and Google client IDs and secrets are entered in the Supabase dashboard (Authentication, Providers), not in this project.

## Checks

- npx tsc --noEmit : type check
- npm run lint : code style
- npm test : automated tests
- npm run build : production build

## Security rules we follow




- The browser never decides who is an admin. Roles live in the database and are checked on the server for every request.
- Admin access also needs an 8-hour signed admin pass, which can be revoked.
- The OWNER cannot be changed, suspended, banned or deleted, and the database enforces this.
- The audit log is append-only.
- The Supabase secret key is only used in server-only files.



