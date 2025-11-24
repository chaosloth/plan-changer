# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Server-based Launtel plan management application built with Next.js, TypeScript, and SQLite. Provides a web UI for managing Launtel internet plan changes with manual triggers, scheduled automation, and comprehensive logging.

**Tech Stack:**
- Next.js 16 (App Router) - Web framework
- TypeScript - Type safety
- SQLite (better-sqlite3) - Data persistence
- node-cron - Background scheduler
- axios + cheerio - HTTP client and HTML parsing for Launtel portal interaction
- Tailwind CSS - Styling

## Development Commands

### Build and Run
```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Clean build artifacts
npm run clean
```

The development server runs on http://localhost:3000 by default.

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Build and run manually
docker build -t launtel-plan-manager .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env launtel-plan-manager

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

See [DOCKER.md](DOCKER.md) for detailed Docker deployment instructions.

## Architecture

### Directory Structure

```
app/                      # Next.js App Router pages and API routes
├── api/                  # API route handlers
│   ├── plans/           # Plan operations (list, change)
│   ├── logs/            # Log retrieval and management
│   ├── settings/        # Settings CRUD
│   └── schedules/       # Schedule CRUD
├── dashboard/           # Dashboard page
├── logs/                # Logs viewer page
├── schedule/            # Schedule management page
├── settings/            # Settings configuration page
├── layout.tsx           # Root layout
├── page.tsx             # Home page
└── globals.css          # Global styles with Tailwind

lib/                     # Core business logic
├── db/                  # Database layer (SQLite)
│   └── index.ts         # Database schema and CRUD operations
├── services/            # Service modules
│   └── plan-changer.ts  # Launtel plan change service
└── scheduler.ts         # Background cron scheduler

components/              # Reusable React components (empty, add as needed)
public/                  # Static assets
data/                    # SQLite database file (gitignored)
```

### Key Components

**Database (`lib/db/index.ts`)**
- SQLite database with three tables: `settings`, `logs`, `schedules`
- Settings table: stores Launtel credentials (single row, id=1)
- Logs table: stores plan change history with success/failure status
- Schedules table: stores automated plan change schedules with time and enabled flag
- Exports CRUD functions for each table

**Plan Changer Service (`lib/services/plan-changer.ts`)**
- Refactored from original cron job into reusable service module
- Exports `changePlan()` function that takes configuration and executes plan change
- Contains plan name to PSID mapping (`PLAN_TO_PSID_CANONICAL`)
- Handles login flow: GET form → parse CSRF/hidden fields → POST credentials
- Handles confirm flow: GET confirm_service → parse form → POST with plan PSID
- Returns `PlanChangeResult` with success status, message, and timestamp

**Background Scheduler (`lib/scheduler.ts`)**
- Initialized via Next.js instrumentation hook on server startup
- Runs every minute checking for scheduled plan changes
- Executes plan changes when current time matches schedule
- Logs all scheduled executions to database
- Replaces the original cron-based approach

**API Routes**
- `/api/plans` (GET) - List all available plans
- `/api/plans/change` (POST) - Trigger immediate plan change
- `/api/logs` (GET/DELETE) - Retrieve or clear logs
- `/api/settings` (GET/POST) - Retrieve or save settings
- `/api/schedules` (GET/POST) - List or create schedules
- `/api/schedules/[id]` (PATCH/DELETE) - Update or delete schedule

**UI Pages**
- `/` - Home page with navigation cards
- `/dashboard` - Manual plan change interface
- `/settings` - Configure Launtel credentials and parameters
- `/logs` - View plan change history
- `/schedule` - Manage automated plan changes

### Data Flow

1. **Initial Setup**: User configures Launtel credentials in Settings page → stored in SQLite
2. **Manual Plan Change**: User selects plan on Dashboard → POST to `/api/plans/change` → service executes → log saved
3. **Scheduled Plan Change**: User creates schedule → stored in SQLite → scheduler runs every minute → executes at specified time → log saved
4. **Viewing Logs**: User visits Logs page → GET from `/api/logs` → displays history

### Scheduler Behavior

- Initializes when Next.js server starts (via `instrumentation.ts`)
- Checks every minute for enabled schedules matching current hour:minute
- Retrieves settings from database for each scheduled execution
- Executes plan change using `changePlan()` service
- Logs results with "Scheduled:" prefix in message
- No overlap prevention needed (server handles concurrency)

## Configuration

### Environment Variables

Configuration is now stored in the SQLite database via the Settings page. The original `.env` file is no longer used for Launtel credentials, but can still be used for Next.js configuration:

```
# Optional: Next.js environment
NODE_ENV=development
PORT=3000
```

### Database Settings

All Launtel configuration is managed through the `/settings` page UI:

**Required:**
- Base URL (default: https://residential.launtel.net.au)
- Username
- Password
- User ID
- Service ID
- AVC ID
- Location ID

**Optional:**
- Discount Code
- Timeout (ms, default: 15000)

## Plan PSID Mapping

Available plans (hardcoded in `lib/services/plan-changer.ts:13-24`):

- Standby → 2623
- nbn100/20 → 2613
- nbn100/40 → 2608
- Home Fast → 2669
- Home SuperFast → 2615
- Ultrafast-100 → 2617
- nbn250/100 → 2664
- Hyperfast → 2666
- IoT 1Mbps → 2629
- IoT 4Mbps → 2635

Aliases are supported (case-insensitive, space/hyphen tolerant): "homefast", "home-fast" → "Home Fast"

## Important Implementation Notes

- **Database initialization**: Tables are created automatically on first import of `lib/db/index.ts`
- **Password security**: Passwords are stored in SQLite but never returned by GET `/api/settings` (returns `hasPassword` flag instead)
- **Scheduler persistence**: Scheduler runs in-process with Next.js server; schedules survive restarts (stored in DB)
- **CSRF handling**: All Launtel form submissions parse and replay hidden fields for CSRF protection
- **Session management**: Each plan change creates a fresh axios client with cookie jar (no session reuse)
- **Authentication detection**: Service checks for unexpected login page redirects using heuristics
- **Success validation**: Confirms plan change by checking response HTML for keywords like "confirmed", "success"
- **Data directory**: `data/` directory must exist for SQLite database; created automatically on first run
- **Instrumentation**: Next.js instrumentation.ts file is automatically enabled in Next.js 16 (no config needed)
- **Standalone mode**: Next.js output mode set to 'standalone' in next.config.js for Docker deployment
- **Docker volumes**: SQLite database persisted via Docker volume mount at `/app/data`
- **Non-root container**: Docker image runs as user `nextjs` (UID 1001) for security

## Development Patterns

- **Client components**: All UI pages use `'use client'` directive for interactivity (state, effects, events)
- **API-first**: UI never directly imports service modules; always calls API routes
- **Error handling**: API routes return appropriate HTTP status codes; UI displays user-friendly messages
- **Type safety**: Shared types between API and UI (Settings, Log, Schedule, Plan)
- **Optimistic updates**: Forms show loading states; logs/schedules refetch after mutations

## Migration from Cron Version

This version replaces the original cron-based script with a modern web application. Key changes:

1. **Execution model**: Changed from standalone script + cron → Next.js server + background scheduler
2. **Configuration**: Changed from `.env` file → SQLite database + UI
3. **Locking**: Removed (server handles concurrency)
4. **CLI arguments**: Removed (UI provides plan selection)
5. **Logging**: Changed from stdout → SQLite database + UI viewer
6. **Service isolation**: Core logic extracted to `lib/services/plan-changer.ts` for reuse
