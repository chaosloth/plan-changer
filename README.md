# Launtel plan-changer (Cron job - Node.js + TypeScript)

Automates Launtel login and service confirmation using a headless HTTP client (axios + cookie jar + cheerio). Designed to run reliably via cron with single-instance locking and clear logs.

What it does
- Logs into https://residential.launtel.net.au using credentials from .env
- Navigates to confirm_service with parameters from .env
- Submits the confirm_service form programmatically (replays hidden fields/CSRF)
- PSID (plan) is chosen from CLI: either --psid NUMBER or --plan "Plan Name"

Tech
- TypeScript, axios, axios-cookiejar-support, tough-cookie (cookies), cheerio (HTML parsing), dotenv, minimist (CLI)
- Single-run lock via temp file to prevent overlaps
- Timestamped stdout/stderr, proper exit codes

Prerequisites
- Node.js 18+ recommended
- npm

Setup
1) Install dependencies
```bash
npm install
```

2) Create and fill .env
```bash
cp .env.example .env
# Edit .env with your Launtel credentials and IDs
```

3) Build
```bash
npm run build
```

4) Run via helper script (recommended)
```bash
# Absolute path as requested:
 /home/cc/plan-changer/downgrade-plan.sh
```
Notes:
- The helper script sources .env and runs the job using a preconfigured plan (currently --plan "Home Fast").
- To change the plan, you can either:
  - edit downgrade-plan.sh, or
  - run directly with node and pass --plan/--psid (see “Direct run (optional)” below).

Direct run (optional)
```bash
# By plan name (case/spacing tolerant + aliases supported)
node dist/index.js --plan "Home Fast"

# Or by PSID directly
node dist/index.js --psid 2669
```

.env keys
```sh
LAUNTEL_BASE=https://residential.launtel.net.au
LAUNTEL_USERNAME=your_username
LAUNTEL_PASSWORD=your_password
LAUNTEL_USERID=your_user_id
LAUNTEL_SERVICE_ID=your_sevice_id
LAUNTEL_AVCID=your_avc_id
LAUNTEL_LOCID=your_loc_id
```

Optional:
```sh
LAUNTEL_DISCOUNT_CODE=
LAUNTEL_UNPAUSE=0
LAUNTEL_COAT=0
LAUNTEL_CHURN=0
LAUNTEL_SCHEDULEDDT=
LAUNTEL_NEW_SERVICE_PAYMENT_OPTION=
LAUNTEL_TIMEOUT_MS=15000
```

Locking/runtime:
```sh
JOB_NAME=plan-changer-job
LOCK_DIR=/tmp
```

Choosing a plan (PSID)
Provide either:
- --psid NUMBER
- --plan "Plan Name" (maps to a PSID using the dictionary below)
If both are provided, --psid takes precedence. If neither is provided, the program exits with a helpful error listing valid plans.

Supported plans (from provided HTML)
- "Standby" → 2623
- "nbn100/20" → 2613
- "nbn100/40" → 2608
- "Home Fast" → 2669
- "Home SuperFast" → 2615
- "Ultrafast-100" → 2617
- "nbn250/100" → 2664
- "Hyperfast" → 2666
- "IoT 1Mbps" → 2629
- "IoT 4Mbps" → 2635

Aliases supported (examples)
- "homefast", "home-fast" → "Home Fast"
- "home superfast", "home-superfast" → "Home SuperFast"
- "ultrafast100", "ultrafast-100" → "Ultrafast-100"
- "iot 1mbps", "iot-1mbps" → "IoT 1Mbps"
- "iot 4mbps", "iot-4mbps" → "IoT 4Mbps"

Debug HTML snapshots
- When enabled, the job writes HTML snapshots to help diagnose flow issues.
- Files (first ~200KB of HTML):
  - Login GET: /tmp/plan-changer-login-get-[timestamp].html
  - Login POST: /tmp/plan-changer-login-post-[timestamp].html
  - Confirm GET (on login detected or form not found): /tmp/plan-changer-confirm-get-[timestamp].html
  - Confirm POST (if success is unclear): /tmp/plan-changer-confirm-post-[timestamp].html

Enable via either:
- CLI flag (for direct node runs):
```bash
node dist/index.js --plan "Home Fast" --debug-html
```
- Environment variable (recommended for script/cron/docker):
```sh
LAUNTEL_DEBUG_HTML=1
```
Examples:
- Script/cron (recommended): add to .env
```sh
LAUNTEL_DEBUG_HTML=1
```
Then run:
```bash
/home/cc/plan-changer/downgrade-plan.sh
```

Cron usage (using the helper script)
1) Build first:
```bash
npm run build
```

2) Create a log file (optional)
```bash
touch "/home/cc/plan-changer/cron.log"
```

3) Edit crontab:
```bash
crontab -e
```

4) Example entry (11:45pm nightly)
```cron
# Recommended environment at top for reliability
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production
JOB_NAME=plan-changer-job
LOCK_DIR=/tmp

# Run the helper script (no need to reference node directly)
45 23 * * * /home/cc/plan-changer/downgrade-plan.sh >> /home/cc/plan-changer/cron.log 2>&1
```

Notes
- Replace /home/cc/plan-changer if your project path differs.
- The helper script sources .env, so cron picks up your configuration automatically (ensure file permissions allow reading).
- Locking prevents overlapping runs; if another instance is detected, the job exits 0 and logs a skip message.

Logging and exit codes
- Success: exit 0 with timestamped logs
- Skip due to existing lock: exit 0
- Failure (login/confirm/HTTP errors): exit 1 with error details

Troubleshooting
- Cron uses a minimal environment; always use absolute paths in cron.
- Check system logs/journal or mail for cron errors.
- Permissions:
```bash
chmod 600 .env
```
  - Ensure your user can write to cron.log and dist/
- Verify system timezone (timedatectl) for expected schedule.
- If blocked by MFA/anti-bot, consider a headless browser fallback approach.

Development
- Watch mode:
```bash
npm run dev -- --plan "Home Fast"
```
- Direct TypeScript (dev only):
```bash
npm start -- --psid 2669
```

Security and compliance
- Do not commit .env; it is ignored by .gitignore.
- Ensure this automation complies with Launtel’s Terms of Service and your account’s security settings.
