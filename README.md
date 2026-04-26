# Enrollment Queuing System

## Project Overview
The Enrollment Queuing System is a digital queue management application designed to streamline student registration and line management during highly active enrollment periods. By digitizing the traditional physical queue, it ensures a more organized, transparent, and fair process for both students waiting in line and the administrative staff managing the service windows.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Backend & Database:** Supabase (PostgreSQL, Authentication, Realtime WebSockets)
- **Data Validation:** Zod
- **Anti-Bot Protection:** Cloudflare Turnstile

## Features
- **Location-Based Registration (Geofencing):** Enforces a strict GPS boundary check, ensuring students are authorized and physically on-campus before joining the queue.
- **Bot & Spam Prevention:** Incorporates Cloudflare Turnstile challenges to prevent automated scripts from overwhelming the registration endpoints.
- **Real-Time Queue Tracking:** Leverages Supabase Realtime to broadcast live status updates to student devices, dynamically updating their wait position and currently serving numbers.
- **Self-Service Queue Lookup:** Provides a recovery mechanism allowing students to retrieve active queue metrics just by entering their Student ID.
- **Comprehensive Admin Dashboard:** Armors system administrators with a unified control panel to construct academic schedules, generate service queues, process students (call next, skip, complete), and manage staff access.

## Configuration
This project is configured dynamically via environment variables. For development environments, defining these in a `.env.local` file at the root directory is mandatory.

### Database & Authentication (Supabase)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project API URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Client-safe anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY` — Privileged backend key (Server-side ONLY).

### Security (Cloudflare Turnstile)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Public site key for widget rendering.
- `TURNSTILE_SECRET_KEY` — Private key for server-side token validation.

### Geofencing (Location Services)
- `NEXT_PUBLIC_CAMPUS_LAT` — Center latitude of the target location.
- `NEXT_PUBLIC_CAMPUS_LNG` — Center longitude of the target location.
- `NEXT_PUBLIC_CAMPUS_RADIUS_METERS` — Permitted radius distance in meters for successful registration.

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CSiron21/enrollment_queuing_system.git
   cd enrollment_queuing_system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Establish Environment Configuration:**
   Create a `.env.local` file at the root of the project and populate it with the keys outlined in the **Configuration** section.

4. **Launch the Development Server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   The development frontend server will be accessible at [http://localhost:3000](http://localhost:3000).

## Project Structure
The architectural pattern follows an MVC-inspired approach nested within a Next.js environment. All primary source logic revolves around the `src/` directory.

```text
src/
├── app/              # Next.js Application Router (Pages, Layouts, API endpoints)
├── components/       # Presentational & Reusable UI elements (Turnstile, Navbar)
├── controllers/      # Route controllers housing primary business constraints
├── lib/              # Ecosystem utilities (Supabase Initialization, Math helpers)
└── models/           # Data operational layer encapsulating Supabase queries
```
