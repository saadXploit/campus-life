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

- Stage 10 (outings and roads): invite friends to eat, play football or hang out together, with the host paying for everyone or everyone paying their own (treated friends are told who paid); job shifts of 3 to 5 minutes; players are seen eating and playing football on the pitch; a ring road with traffic, a main gate road and arch, and car parks by the gate and the Faculty Block.

- Stage 11A (shop): real-money purchases through Paystack for items only (never game naira), 18+ only; cars (parked by the main gate, drive anywhere for 1 energy and give up to 3 friends a lift), outfits, accessories, gold and diamond name tags, hostel room upgrades; a webhook and a return page that both confirm the payment with Paystack before handing anything over; admin purchases page and a shop on/off switch; refund policy page. Set PAYSTACK_SECRET_KEY to switch it on.

- Stage 12 (leave any time): a Stop button on every activity, including work, lectures, exams and sleep. Leaving early is fair: you keep only part of a meal or activity's benefit, work pays for the time worked (no bonus, no raise credit), a lecture or study session does not count, and walking out of an exam cuts the exam mark.

- Stage 13 (game-money shop and a new look): the shop now sells everything for game naira (cars ₦10,000 to ₦200,000); an admin switch moves it to real money (Paystack) later. Redesigned landing page, sign-in, character creator, university list (with federal/state/private filters), application, screening and result pages, with a journey tracker on every step.

- Stage 14 (ready to publish): cars, bicycles, scooters and okada are off the shop for now (switched off, not deleted; game money refunded to car owners). Privacy policy and terms pages.

- Stage 15 (fees and rent): school fees and rent every semester (the admission semester is covered), due two weeks in, 10% late fee; unpaid fees block exams and unpaid rent halves sleep energy; four room types with different rents and sleep bonuses. Taps now show their result instantly while the server confirms, and background checks no longer delay taps.

- Stage 16 (short semesters): a semester is 2 weeks (10 days of lectures, 2 of exams, 2 of holiday); every course meets twice a day; attending half of the lectures held counts as full attendance; fees are due 5 days in. The running semester keeps its start date.

- Stage 17 (physiotherapy and mini-map): DPT Physiotherapy (6 years, Faculty of Health Sciences); a mini-map in the corner of the game showing the campus, you (moving live) and your online friends, which opens into a bigger map with where each friend is, what they are doing and a Join button. Live at campus-life.study; the old netlify.app address redirects there.

The long-term goal is an explorable 3D multiplayer campus. All game rules live in the database (Postgres functions), so the 3D client can be added without rewriting them.

## How the game stays fair

- Every game action runs as a Postgres function that only the server can call. The browser can read its own data but never write.
- Money is stored in kobo (whole numbers). Every balance change goes through one function, wallet_apply, which also writes the ledger line. Balances can never go below zero.

## Publishing (going live): Netlify + Supabase + X and Google sign-in

1. Put the code on GitHub (a private repository is fine). Never commit .env.local.
2. Netlify: Add new site, Import an existing project, pick the repository. Netlify detects Next.js and sets the build command (npm run build) itself.
3. Netlify, Site configuration, Environment variables: add every value from .env.local. Set NEXT_PUBLIC_SITE_URL to the real address (for example https://campuslife.netlify.app or your own domain) and set NEXT_PUBLIC_CONTACT_EMAIL. Then deploy.
4. Speed: Netlify, Site configuration, Functions, Region: if your plan lets you choose, pick the region closest to your Supabase project's region (Supabase, Project Settings, General). The game server and the database then sit next to each other.
5. Supabase, Authentication, URL Configuration: set Site URL to the real address, and add https://YOUR-SITE/auth/callback and https://YOUR-SITE/admin/callback to Redirect URLs.
6. Google Cloud console, OAuth consent screen: add your domain and the links to /privacy and /terms, then switch the app from Testing to In production so anyone can sign in.
7. X developer portal: add the real website address. The callback URL stays the Supabase one.
8. Make sure every SQL file in supabase/migrations has been run, in order, on the Supabase project the live site uses.
9. Sign in once with the owner's X account (OWNER_X_USER_ID) and open /admin to check staff access.
10. When Paystack is approved: add PAYSTACK_SECRET_KEY in Netlify, set the webhook to https://YOUR-SITE/api/paystack/webhook, and switch the shop to real money in Admin, Game settings.

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



