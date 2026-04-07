# HAU Enrollment Queuing System

Digital enrollment queue management for Holy Angel University — School of Computing.

## Tech Stack

- **Frontend**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime + Auth)
- **Deployment**: Vercel

## Deployment Guide: Vercel + Supabase

Follow these steps to deploy the system to a clean server environment.

### 1. Supabase Setup (Database & Auth)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Go to **SQL Editor** > **New Query**.
3. Paste the contents of `supabase_setup.sql` and click **Run**.
4. Go to **Project Settings** > **API** and copy your credentials:
   - `Project URL`
   - `anon public` key
   - `service_role` key
5. Create an admin user:
   - Go to **Authentication** > **Users** > **Add User** > **Create new user**.
   - Enter an email and password (this will be used to log into the admin dashboard).

### 2. Prepare Your Kiosk Secret

Because the system blocks students from registering remotely, it uses a secure device authorization cookie. You need to generate a random 32-64 character string (letters and numbers) to sign these cookies.
- *Example*: `72e38c5aa1ad009088ba7b0ee5fc8f7736`
- Keep this handy for the Vercel deployment.

### 3. Vercel Deployment

1. Push your code to a GitHub repository.
2. Import the project in [vercel.com](https://vercel.com).
3. Expand the **Environment Variables** section and add the following:
   - `NEXT_PUBLIC_SUPABASE_URL` = *(Your Supabase Project URL)*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(Your Supabase anon key)*
   - `SUPABASE_SERVICE_ROLE_KEY` = *(Your Supabase service_role key)*
   - `KIOSK_SECRET` = *(Your generated random string)*
4. Click **Deploy**.

### 4. Authorizing the Registration Computer

Once deployed, the `/register` and `/queue` pages will be locked. To unlock them:
1. On the physical computer that will be used for registration, open your Vercel URL and navigate to `/admin`.
2. Log in using the admin account you created in Supabase.
3. On the dashboard, locate the red "Kiosk Mode" banner and click **🔑 Authorize This Device**.
4. The device is now authorized, and you can safely navigate to `/register` and `/queue`.

## Local Development

```bash
# 1. Copy env file and fill in your Supabase keys
cp .env.local.example .env.local

# 2. Add your KIOSK_SECRET (random string) to .env.local
# Example: KIOSK_SECRET=your_random_string_here

# 3. Install dependencies
npm install

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/register` | Student registration form to join queue (Kiosk Authorized Only) |
| `/student/[id]` | Student POV — queue status with 30s auto-refresh |
| `/queue` | General queue board — all active queues (Kiosk Authorized Only) |
| `/admin` | Admin login |
| `/admin/dashboard` | Admin dashboard — manage queues, schedules, courses |

## Project Structure (MVC)

```
src/
├── models/           # Data access (Supabase queries)
├── controllers/      # Business logic
├── app/              # Views (pages) + API routes
├── components/       # Reusable UI components
└── lib/              # Supabase client setup
```
