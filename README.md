# HAU Enrollment Queuing System

Digital enrollment queue management for Holy Angel University — School of Computing.

## Tech Stack

- **Frontend**: Next.js 16 (App Router, React 19)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL + Realtime + Row Level Security + Auth)
- **Deployment**: [Vercel](https://vercel.com)
- **Bot Protection**: [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (CAPTCHA alternative on registration & tracking forms)
- **Geofencing**: GPS-based campus boundary check (latitude, longitude, radius) to restrict registration to on-campus devices

## Deployment Guide: Vercel + Supabase

Follow these steps to deploy the system to a clean server environment.

### 1. Supabase Setup (Database & Auth)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Go to **SQL Editor** > **New Query**.
3. Paste and run the contents of `supabase_setup.sql`, then `migration_add_course_id.sql`, then `migration_rpc_join_queue.sql`.
4. Go to **Project Settings** > **API** and copy your credentials:
   - `Project URL`
   - `anon public` key
   - `service_role` key
5. Create an admin user:
   - Go to **Authentication** > **Users** > **Add User** > **Create new user**.
   - Enter an email and password (this will be used to log into the admin dashboard).

### 2. Cloudflare Turnstile Setup (Bot Protection)

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com) and sign in (or create a free account).
2. Navigate to **Turnstile** in the left sidebar.
3. Click **Add Site**.
4. Enter a site name (e.g., "HAU Enrollment") and your deployment domain.
5. Choose the widget type (Managed is recommended) and click **Create**.
6. Copy the two keys:
   - **Site Key** → used as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Secret Key** → used as `TURNSTILE_SECRET_KEY`

### 3. Campus Geofence Configuration

The system uses GPS coordinates to restrict student registration to on-campus devices only.

1. Open [Google Maps](https://maps.google.com) and navigate to your campus.
2. Right-click the center of the campus and copy the coordinates (latitude, longitude).
3. Decide on a radius in meters that covers the entire campus area.
4. Set the three environment variables:
   - `NEXT_PUBLIC_CAMPUS_LAT` — center latitude
   - `NEXT_PUBLIC_CAMPUS_LNG` — center longitude
   - `NEXT_PUBLIC_CAMPUS_RADIUS_METERS` — allowed radius in meters

### 4. Vercel Deployment

1. Push your code to a GitHub repository.
2. Import the project in [vercel.com](https://vercel.com).
3. Expand the **Environment Variables** section and add **all** of the variables listed in the [Environment Variables](#environment-variables) section below.
4. Click **Deploy**.

---

## Environment Variables

The table below lists every environment variable the system requires.

| Variable | Public? | Description | How to Obtain |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project REST URL | Supabase → **Project Settings** → **API** → *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous (public) API key | Supabase → **Project Settings** → **API** → *anon public* key |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Supabase service-role key (full DB access, server-only) | Supabase → **Project Settings** → **API** → *service_role* key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile widget site key | Cloudflare Dashboard → **Turnstile** → your site → *Site Key* |
| `TURNSTILE_SECRET_KEY` | **No** | Cloudflare Turnstile server-side secret key | Cloudflare Dashboard → **Turnstile** → your site → *Secret Key* |
| `NEXT_PUBLIC_CAMPUS_LAT` | Yes | Campus center latitude for GPS geofence (default: `15.132319684174114`) | Use Google Maps: right-click the campus center → copy latitude |
| `NEXT_PUBLIC_CAMPUS_LNG` | Yes | Campus center longitude for GPS geofence (default: `120.58956372807982`) | Use Google Maps: right-click the campus center → copy longitude |
| `NEXT_PUBLIC_CAMPUS_RADIUS_METERS` | Yes | Allowed radius in meters around the campus center (default: `200`) | Set based on your campus size |

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All others are server-only and must be kept secret.

### `.env.local` Example

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA...
TURNSTILE_SECRET_KEY=0x4AAAAAAA...

# Campus Geofence (optional — defaults shown)
NEXT_PUBLIC_CAMPUS_LAT=15.132319684174114
NEXT_PUBLIC_CAMPUS_LNG=120.58956372807982
NEXT_PUBLIC_CAMPUS_RADIUS_METERS=200
```

## Local Development

```bash
# 1. Create a .env.local file and fill in all variables
#    (see the Environment Variables section above)
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
| `/register` | Student registration form to join queue (Geofence + Turnstile protected) |
| `/track` | Find your queue — enter Student ID to look up queue status (Turnstile protected) |
| `/student/[id]` | Student POV — live queue status with auto-refresh |
| `/queue` | General queue board — all active queues |
| `/admin` | Admin login |
| `/admin/dashboard` | Admin dashboard — manage queues, schedules, courses, admins |

## Project Structure (MVC)

```
src/
├── models/           # Data access (Supabase queries)
├── controllers/      # Business logic
├── app/              # Views (pages) + API routes
├── components/       # Reusable UI components (Navbar, Turnstile, InteractiveParticles)
└── lib/              # Supabase clients, geofence, turnstile verification, validators
```
