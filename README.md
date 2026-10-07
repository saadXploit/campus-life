# CAMPUS LIFE

A multiplayer university life-simulation game. Next.js (App Router) + TypeScript + Tailwind + Framer Motion, with Supabase (PostgreSQL + Auth).

## Status

- Stage 1 (foundation): X and Google login for players, X-only admin login, OWNER / SUPER_ADMIN / ADMIN / MODERATOR roles, staff invites and management, audit log, admin session limits, rate limiting, security headers.
- Stage 2 (admission): character creation with a wallet and ledger, university explorer, application, timed screening exam, results, change-of-course offers, enrolment.
- Stage 3 (campus day): shared world clock, energy / health / happiness, campus map with travel, activities at each location (sleep ends the day), a hostel scene with a 3D avatar (scene art still to be added in public/scenes/hostel).

- Stage 3 (3D): explorable 3D campus with a rigged avatar, walking, building interiors where activities are acted out, waking up early (at most one day ahead of the campus calendar).
- Stage 4 (economy): money transfers between players (no double sends, daily limits, account-age rule), wallet history, notifications, a protected ledger, admin game settings (pause new registrations, transfer limits) and audited admin wallet adjustments.

- Stage 5A (real time): the game runs on real Nigerian time (WAT) for everyone. Activities take real minutes, sleep lasts as long as you like and restores energy with real time asleep, energy-giving activities have cooldowns. The whole game screen loads in one database call and every action is one call.

- Stage 5B (social places): real players appear where they are (rooms and around campus); talk, toast, dance, high five, study together and fight depending on the place; bonds between players; local chat with speech bubbles; block and report; moderator reports page; live-generated ambient sound for every place.

The long-term goal is an explorable 3D multiplayer campus. All game rules live in the database (Postgres functions), so the 3D client can be added without rewriting them.

## How the game stays fair

- Every game action runs as a Postgres function that only the server can call. The browser can read its own data but never write.
- Money is stored in kobo (whole numbers). Every balance change goes through one function, wallet_apply, which also writes the ledger line. Balances can never go below zero.

## Run it on your computer

1. Install Node.js 22 LTS and Git.
2. npm install
3. Copy .env.example to .env.local and fill in the values (see below).
4. Run the SQL files in supabase/migrations in order, using the Supabase SQL Editor. Each file runs once, except 20261007000004_rate_limits.sql, which is safe to run again.
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



