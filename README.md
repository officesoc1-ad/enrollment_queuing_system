# HAU Enrollment Queuing System

Digital enrollment queue management for Holy Angel University — School of Computing.

## Tech Stack

- **Frontend**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime + Auth)
- **Deployment**: Vercel

## Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** > **New Query**
3. Paste the contents of `supabase_setup.sql` and click **Run**
4. Go to **Settings** > **API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Create an admin user:
   - Go to **Authentication** > **Users** > **Add User**
   - Enter an email and password (this will be used to log into the admin dashboard)

## Local Development

```bash
# 1. Copy env file and fill in your Supabase keys
cp .env.local.example .env.local

# 2. Install dependencies
npm install

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/register` | Student registration form to join queue |
| `/student/[id]` | Student POV — queue status with live updates |
| `/queue` | General queue board — all active queues (for display monitors) |
| `/admin` | Admin login |
| `/admin/dashboard` | Admin dashboard — manage queues, schedules, courses |

## Vercel Deployment

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
4. Deploy

## Project Structure (MVC)

```
src/
├── models/           # Data access (Supabase queries)
├── controllers/      # Business logic
├── app/              # Views (pages) + API routes
├── components/       # Reusable UI components
└── lib/              # Supabase client setup
```
