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

4) Run (choose a plan via --plan or provide a PSID via --psid)
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

Cron usage
1) Build first:
```bash
npm run build
```

2) Find absolute node path:
```bash
which node
# e.g. /usr/bin/node
```

3) Edit crontab:
```bash
crontab -e
```

4) Example entries (choose one):
```cron
# Recommended environment at top for reliability
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production

# Option A: choose by plan name
45 23 * * * /usr/bin/node $HOME/plan-changer/dist/index.js --plan "Home Fast" >> $HOME/plan-changer/cron.log 2>&1

# Option B: choose by PSID directly
45 23 * * * /usr/bin/node $HOME/plan-changer/dist/index.js --psid 2669 >> $HOME/plan-changer/cron.log 2>&1
```

## Cron setup (step-by-step)

1) Prepare the project
- Ensure the project path is correct (example: $HOME/plan-changer)
- Create and fill your .env:
  - cp .env.example .env
  - Edit .env with your Launtel credentials and IDs

2) Install and build
- npm install
- npm run build
This generates dist/index.js

3) Test once manually
- By plan name:
  - node dist/index.js --plan "Home Fast"
- Or by PSID:
  - node dist/index.js --psid 2669
- Confirm it completes successfully (exit code 0). Fix any issues before adding to cron.

4) Create a log file (optional)
- touch "$HOME/plan-changer/cron.log"

5) Find the absolute path to Node
- which node
- Example: /usr/bin/node
Use this exact path in your crontab.

6) Open your crontab editor
- crontab -e

7) Add environment header (recommended)
At the top of crontab:
```cron
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production
# Optional:
JOB_NAME=plan-changer-job
LOCK_DIR=/tmp
```

8) Add the scheduled job (11:45pm nightly)
- By plan name:
  45 23 * * * /usr/bin/node $HOME/plan-changer/dist/index.js --plan "Home Fast" >> $HOME/plan-changer/cron.log 2>&1
- Or by PSID:
  45 23 * * * /usr/bin/node $HOME/plan-changer/dist/index.js --psid 2669 >> $HOME/plan-changer/cron.log 2>&1
Replace /usr/bin/node with your which node output if different.

9) Save and verify
- Save and exit the editor, then:
```bash
crontab -l
```

10) Monitor logs
```bash
tail -f "$HOME/plan-changer/cron.log"
```
After 11:45pm you should see timestamped logs. If another instance is running, a skip message is logged and exit code is 0.

11) Optional: log rotation
Example (requires root) /etc/logrotate.d/plan-changer:
```
/home/USER/plan-changer/cron.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    copytruncate
}
```
Replace USER with your username or adapt to your environment.

12) Troubleshooting
- Cron uses a minimal environment; always use absolute paths to node and project.
- Check system logs/journal or mail for cron errors.
- Permissions:
```bash
chmod 600 .env
```
  - Ensure your user can write to cron.log and dist/
- Verify system timezone (timedatectl) for expected schedule.
- If blocked by MFA/anti-bot, consider a headless browser fallback approach.

Notes
- Replace /usr/bin/node with your which node output.
- Replace $HOME/plan-changer with the absolute path to this project.
- Cron has a minimal environment; do not call npm run ... from cron. Invoke node directly on dist/index.js.
- Locking prevents overlapping runs; if another instance is detected, the job exits 0 and logs a skip message.

Logging and exit codes
- Success: exit 0 with timestamped logs
- Skip due to existing lock: exit 0
- Failure (login/confirm/HTTP errors): exit 1 with error details

How it works (high level)
- Login:
  - GET /login to establish session and fetch hidden fields/CSRF
  - POST login form with username/password (and all hidden fields)
- Confirm:
  - GET /confirm_service?userid=...&psid=...&... using values from .env + CLI
  - Parse the confirm_service form, replay all hidden inputs
  - Override key fields (userid, psid, avcid, locid, unpause, etc.) from env/CLI
  - POST the form to submit confirmation
- Success detection:
  - Heuristic scan of response HTML for common success terms
  - You can tighten this by matching known success text unique to your account flow

Troubleshooting
- 401/403/redirect loops: credentials wrong, or additional auth (MFA) may be required.
- Anti-bot/JS challenges: If encountered, consider switching to a headless browser approach (e.g., Playwright). This project uses a lightweight HTTP client by default.
- Stale lock file after crash:
```bash
rm -f /tmp/plan-changer-job.lock
# or: rm -f ${LOCK_DIR}/${JOB_NAME}.lock  (if customized)
```

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
