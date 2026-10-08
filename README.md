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

- Stage 6A (ads and 3D map): admin-managed ads (billboards, club songs, market products) with schedules, campus targeting, once-per-day view and click counts; a 3D aerial campus map; login page shows who is signed in and lets you switch accounts.

- Stage 7A (academics): 10 universities (federal, state, private) with their own rules; courses per level and semester with weekly lectures at real Nigerian times; attendance, study, exam week, results (CA + exam, 5-point scale), GPA/CGPA, promotion to the next level; strikes declared by staff; private-university curfew fine.

- Stage 7B (3D faculties): a 3D building for every faculty on campus (yours highlighted) and a lecture theatre with your department banner, projector screen and a lecturer during live lectures.
- Stage 8A (friends, chats, dating): friend requests, private chats (friends only), group chats, campus chat, mute/block/report messages, opt-in 18+ dating with consent, one partner at a time, breakups and history, gifts.

- Stage 8B (crowd control): busy places split into rooms (you join where your friends are), you see active friends plus a few nearby strangers who share their location, only active players appear live, your own hostel room with roommates, visiting a friend's room, admin crowd settings, and a folding panel so rooms stay visible.

- Stage 9 (jobs and campus staff): 8 jobs paying ₦5,000 to ₦20,000 a shift, bosses who are staff characters (never players), real-time shifts paid when they end, raises after 10 and 30 shifts, a daily shift limit, requirements (level, CGPA, age), admin pay controls; security guards, cleaners, porters and a groundsman on duty by the clock, drawn by the game with no network traffic.

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



