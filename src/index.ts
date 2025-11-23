/**
 * Launtel cron-friendly Node.js TypeScript job.
 *
 * Features:
 * - Single-instance lock using an OS temp lock file to prevent overlapping runs
 * - Loads configuration from .env
 * - CLI options: --psid NUMBER or --plan "Plan Name" (PSID mapping from provided HTML)
 * - Logs to stdout/stderr with timestamps (cron-friendly)
 * - Proper exit codes (0 on success/skip, 1 on error)
 *
 * Flow:
 *   1) Login to Launtel using username/password from .env (with cookie jar + CSRF-safe hidden-field replay)
 *   2) GET /confirm_service?... with parameters from .env and psid from CLI
 *   3) Parse the confirm form and submit POST with collected hidden inputs (override with env + psid)
 */

import { promises as fsp } from "fs";
import fsSync from "fs";
import os from "os";
import path from "path";

import dotenv from "dotenv";
import minimist from "minimist";
import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";

// Load environment variables early
dotenv.config();

// Locking
const JOB_NAME = process.env.JOB_NAME || "plan-changer-job";
const LOCK_DIR = process.env.LOCK_DIR || os.tmpdir();
const LOCK_FILE = path.join(LOCK_DIR, `${JOB_NAME}.lock`);
let lockAcquired = false;

// ---- CLI: Plan Name -> PSID mapping (from provided HTML) ----
// Canonical plan names (display names) and their PSIDs
const PLAN_TO_PSID_CANONICAL: Record<string, number> = {
    "Standby": 2623,
    "nbn100/20": 2613,
    "nbn100/40": 2608,
    "Home Fast": 2669,
    "Home SuperFast": 2615,
    "Ultrafast-100": 2617,
    "nbn250/100": 2664,
    "Hyperfast": 2666,
    "IoT 1Mbps": 2629,
    "IoT 4Mbps": 2635,
};

// Normalization helper (lowercase, remove spaces and hyphens, collapse repeats)
function normalizePlanName(s: string): string {
    return s.trim().toLowerCase()
        .replace(/[\s]+/g, " ") // normalize spaces
        .replace(/\s*-\s*/g, "-") // normalize hyphens around
        .replace(/\s+/g, "")      // remove remaining spaces
        .replace(/-+/g, "-");     // collapse hyphens
}

// Build normalized lookup with aliases
const PLAN_NAME_ALIASES: Record<string, string> = {
    "homefast": "Home Fast",
    "home-fast": "Home Fast",
    "homesuperfast": "Home SuperFast",
    "home-superfast": "Home SuperFast",
    "ultrafast100": "Ultrafast-100",
    "ultrafast-100": "Ultrafast-100",
    "iot1mbps": "IoT 1Mbps",
    "iot-1mbps": "IoT 1Mbps",
    "iot4mbps": "IoT 4Mbps",
    "iot-4mbps": "IoT 4Mbps",
};
const NORMALIZED_TO_CANONICAL: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const canonical of Object.keys(PLAN_TO_PSID_CANONICAL)) {
        map[normalizePlanName(canonical)] = canonical;
    }
    for (const [aliasNorm, canonical] of Object.entries(PLAN_NAME_ALIASES)) {
        map[aliasNorm] = canonical;
    }
    return map;
})();

function resolvePlanToPsid(planInput: string): { psid: number, canonical: string } | null {
    const norm = normalizePlanName(planInput);
    const canonical = NORMALIZED_TO_CANONICAL[norm];
    if (!canonical) return null;
    return { psid: PLAN_TO_PSID_CANONICAL[canonical], canonical };
}

function allPlanNames(): string[] {
    return Object.keys(PLAN_TO_PSID_CANONICAL);
}

// ---- ENV + CLI ----

type EnvConfig = {
    base: string;
    username: string;
    password: string;
    userId: string;
    serviceId: string;
    avcId: string;
    locId: string;
    discountCode: string;
    unpause: string;
    coat: string;
    churn: string;
    scheduledDt: string;
    newServicePaymentOption: string;
    timeoutMs: number;
    debugHtml: boolean;
    psid: string; // resolved from CLI
    planUsed?: string; // informational
};

function loadEnvAndArgs(): EnvConfig {
    const missing: string[] = [];
    const base = process.env.LAUNTEL_BASE || "https://residential.launtel.net.au";
    const username = process.env.LAUNTEL_USERNAME || "";
    const password = process.env.LAUNTEL_PASSWORD || "";
    const userId = process.env.LAUNTEL_USERID || "";
    const serviceId = process.env.LAUNTEL_SERVICE_ID || "";
    const avcId = process.env.LAUNTEL_AVCID || "";
    const locId = process.env.LAUNTEL_LOCID || "";

    if (!username) missing.push("LAUNTEL_USERNAME");
    if (!password) missing.push("LAUNTEL_PASSWORD");
    if (!userId) missing.push("LAUNTEL_USERID");
    if (!serviceId) missing.push("LAUNTEL_SERVICE_ID");
    if (!avcId) missing.push("LAUNTEL_AVCID");
    if (!locId) missing.push("LAUNTEL_LOCID");

    const discountCode = process.env.LAUNTEL_DISCOUNT_CODE ?? "";
    const unpause = process.env.LAUNTEL_UNPAUSE ?? "0";
    const coat = process.env.LAUNTEL_COAT ?? "0";
    const churn = process.env.LAUNTEL_CHURN ?? "0";
    const scheduledDt = process.env.LAUNTEL_SCHEDULEDDT ?? "";
    const newServicePaymentOption = process.env.LAUNTEL_NEW_SERVICE_PAYMENT_OPTION ?? "";
    const timeoutMs = Number(process.env.LAUNTEL_TIMEOUT_MS || 15000);

    // CLI args
    const argv = minimist(process.argv.slice(2), {
        string: ["plan", "psid"],
        boolean: ["debug-html"],
        alias: { p: "plan", d: "debug-html" },
        default: { "debug-html": false },
    });

    let psid: string | undefined;
    let planUsed: string | undefined;

    if (argv.psid) {
        psid = String(argv.psid);
    } else if (argv.plan) {
        const resolved = resolvePlanToPsid(String(argv.plan));
        if (!resolved) {
            console.error(`[${new Date().toISOString()}] Unknown plan "${argv.plan}". Valid plans: ${allPlanNames().join(", ")}`);
            process.exit(1);
        }
        psid = String(resolved.psid);
        planUsed = resolved.canonical;
    }

    if (!psid) {
        console.error(`[${new Date().toISOString()}] Missing required option: --psid NUMBER or --plan "Plan Name". Valid plans: ${allPlanNames().join(", ")}`);
        process.exit(1);
    }

    if (missing.length > 0) {
        console.error(`[${new Date().toISOString()}] Missing required env vars: ${missing.join(", ")}`);
        process.exit(1);
    }

    // Debug HTML snapshots flag (CLI --debug-html or env LAUNTEL_DEBUG_HTML=1/true/yes)
    const debugHtmlEnv = String(process.env.LAUNTEL_DEBUG_HTML || "").toLowerCase();
    const debugHtml = argv["debug-html"] === true || debugHtmlEnv === "1" || debugHtmlEnv === "true" || debugHtmlEnv === "yes";

    return {
        base,
        username,
        password,
        userId,
        serviceId,
        avcId,
        locId,
        discountCode,
        unpause,
        coat,
        churn,
        scheduledDt,
        newServicePaymentOption,
        timeoutMs,
        debugHtml,
        psid,
        planUsed,
    };
}

// ---- HTTP client helpers ----

async function createHttpClient(baseURL: string, timeoutMs: number): Promise<AxiosInstance> {
    const jar = new CookieJar();
    const instance = axios.create({
        baseURL,
        withCredentials: true,
        // @ts-ignore: axios-cookiejar-support augments config to allow jar
        jar,
        timeout: timeoutMs,
        maxRedirects: 10,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        validateStatus: () => true, // we'll handle non-2xx manually
    });
    const { wrapper } = await import("axios-cookiejar-support");
    return wrapper(instance);
}

function absoluteUrl(base: string, maybeRelative: string | undefined | null): string {
    const action = maybeRelative && maybeRelative.trim().length > 0 ? maybeRelative : "/";
    try {
        return new URL(action, base).toString();
    } catch {
        return action; // best effort
    }
}

function collectFormInputs($: cheerio.CheerioAPI, form: any): Record<string, string> {
    const data: Record<string, string> = {};
    // inputs
    $(form)
        .find("input[name]")
        .each((_, el) => {
            const name = $(el).attr("name");
            if (!name) return;
            const type = ($(el).attr("type") || "text").toLowerCase();
            if (type === "checkbox" || type === "radio") {
                if ($(el).is(":checked")) {
                    data[name] = $(el).val()?.toString() ?? "on";
                }
            } else {
                data[name] = $(el).val()?.toString() ?? "";
            }
        });
    // selects
    $(form)
        .find("select[name]")
        .each((_, el) => {
            const name = $(el).attr("name");
            if (!name) return;
            const selected = $(el).find("option:selected");
            if (selected.length > 0) {
                data[name] = selected.attr("value") ?? selected.text();
            } else {
                const first = $(el).find("option").first();
                if (first.length > 0) {
                    data[name] = first.attr("value") ?? first.text();
                }
            }
        });
    // textareas
    $(form)
        .find("textarea[name]")
        .each((_, el) => {
            const name = $(el).attr("name");
            if (!name) return;
            data[name] = $(el).text();
        });
    return data;
}

// ---- Launtel-specific steps ----

async function login(client: AxiosInstance, env: EnvConfig): Promise<void> {
    const returnUrl = `/service_details?avcid=${encodeURIComponent(env.avcId)}&userid=${encodeURIComponent(env.userId)}`;
    const loginUrl = `/login?return_url=${encodeURIComponent(returnUrl)}`;

    console.log(`[${new Date().toISOString()}] GET ${loginUrl}`);
    const getResp = await client.get(loginUrl);
    const htmlLoginGet = String(getResp.data || "");
    if (env.debugHtml) {
        try {
            const snap = path.join(os.tmpdir(), `plan-changer-login-get-${Date.now()}.html`);
            await fsp.writeFile(snap, htmlLoginGet.slice(0, 200000));
            console.log(`[${new Date().toISOString()}] Saved login GET snapshot: ${snap}`);
        } catch { }
    }
    if (getResp.status >= 400) {
        throw new Error(`Login page GET failed with status ${getResp.status}`);
    }

    const $ = cheerio.load(htmlLoginGet);
    // Heuristic: take the first POST form on the page
    const formEl = $("form[method='post']").first();
    if (formEl.length === 0) {
        throw new Error("Login form not found on the page");
    }

    const action = absoluteUrl(env.base, formEl.attr("action") || "/login");
    let fields = collectFormInputs($, formEl.get(0));

    // Try common username/password field names and override
    const userField = ["username", "email", "user", "login"].find((n) => Object.prototype.hasOwnProperty.call(fields, n)) || "username";
    const passField = ["password", "passwd", "pass"].find((n) => Object.prototype.hasOwnProperty.call(fields, n)) || "password";
    fields[userField] = env.username;
    fields[passField] = env.password;

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);

    console.log(`[${new Date().toISOString()}] POST ${action} (login)`);
    const postResp = await client.post(action, body.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": env.base,
            "Referer": new URL(loginUrl, env.base).toString(),
        },
        maxRedirects: 10,
    });

    if (env.debugHtml) {
        try {
            const snap = path.join(os.tmpdir(), `plan-changer-login-post-${Date.now()}.html`);
            await fsp.writeFile(snap, String(postResp.data || "").slice(0, 200000));
            console.log(`[${new Date().toISOString()}] Saved login POST snapshot: ${snap}`);
        } catch { }
    }

    if (postResp.status >= 400) {
        throw new Error(`Login POST failed with status ${postResp.status}`);
    }

    // Simple validation: attempt to access a known authenticated page (confirm_service GET will validate further)
    console.log(`[${new Date().toISOString()}] Login flow completed (status ${postResp.status}).`);
}

function buildConfirmGetUrl(env: EnvConfig): string {
    const qs = new URLSearchParams({
        userid: env.userId,
        psid: env.psid,
        unpause: env.unpause,
        service_id: env.serviceId,
        discount_code: env.discountCode,
        avcid: env.avcId,
        locid: env.locId,
        coat: env.coat,
        churn: env.churn,
    });
    return `/confirm_service?${qs.toString()}`;
}

async function confirmService(client: AxiosInstance, env: EnvConfig): Promise<void> {
    const confirmGetPath = buildConfirmGetUrl(env);
    const confirmGetUrl = new URL(confirmGetPath, env.base).toString();

    console.log(`[${new Date().toISOString()}] GET ${confirmGetUrl}`);
    const getResp = await client.get(confirmGetPath, {
        headers: {
            "Referer": new URL(`/service_details?avcid=${encodeURIComponent(env.avcId)}&userid=${encodeURIComponent(env.userId)}`, env.base).toString(),
        },
    });
    if (getResp.status >= 400) {
        throw new Error(`Confirm page GET failed with status ${getResp.status}`);
    }

    const htmlGet = String(getResp.data || "");
    const $ = cheerio.load(htmlGet);

    // Detect if we landed on a login page unexpectedly
    const looksLikeLogin =
        $("input[type='password']").length > 0 ||
        $("form[action*='login' i]").length > 0 ||
        /login/i.test($("title").text());
    const debugHtmlEnv = String(process.env.LAUNTEL_DEBUG_HTML || "").toLowerCase();
    const debugHtml = env.debugHtml || debugHtmlEnv === "1" || debugHtmlEnv === "true" || debugHtmlEnv === "yes";

    if (looksLikeLogin) {
        let snapPath = "";
        try {
            if (debugHtml) {
                snapPath = path.join(os.tmpdir(), `plan-changer-confirm-get-${Date.now()}.html`);
                await fsp.writeFile(snapPath, htmlGet.slice(0, 200000));
            }
        } catch { }
        throw new Error(`Not authenticated on confirm page (login detected). Status ${getResp.status}${snapPath ? `; snapshot: ${snapPath}` : ""}`);
    }

    // Log available forms for diagnostics
    const forms = $("form");
    console.log(`[${new Date().toISOString()}] Found ${forms.length} forms on confirm page`);
    forms.each((i, el) => {
        const name = $(el).attr("name") || "";
        const action = $(el).attr("action") || "";
        const method = ($(el).attr("method") || "get").toUpperCase();
        const inputs = $(el).find("input").length;
        const selects = $(el).find("select").length;
        const textareas = $(el).find("textarea").length;
        console.log(`[${new Date().toISOString()}] form[${i}]: method=${method} name="${name}" action="${action}" fields: input=${inputs} select=${selects} textarea=${textareas}`);
    });

    // Find the confirm form by prioritized selectors
    let formEl = $("form[name='confirm_service']").first();
    if (formEl.length === 0) {
        formEl = $("form[action*='/confirm_service']").first();
    }
    if (formEl.length === 0) {
        formEl = $("form:has(input[name='psid'])").first();
    }
    if (formEl.length === 0) {
        let snapPath = "";
        try {
            if (debugHtml) {
                snapPath = path.join(os.tmpdir(), `plan-changer-confirm-get-${Date.now()}.html`);
                await fsp.writeFile(snapPath, htmlGet.slice(0, 200000));
            }
        } catch { }
        throw new Error(`Confirm form not found on the page${snapPath ? `; snapshot: ${snapPath}` : ""}`);
    }

    const action = absoluteUrl(env.base, formEl.attr("action") || "/confirm_service");
    let fields = collectFormInputs($, formEl.get(0));

    // Override with env/CLI-controlled values
    const overrides: Record<string, string> = {
        ntdreplace: fields["ntdreplace"] ?? "0",
        ntdupgrade: fields["ntdupgrade"] ?? "0",
        userid: env.userId,
        psid: env.psid,
        locid: env.locId,
        avcid: env.avcId,
        unpause: env.unpause,
        scheduleddt: env.scheduledDt,
        coat: env.coat,
        new_service_payment_option: env.newServicePaymentOption,
    };
    for (const [k, v] of Object.entries(overrides)) fields[k] = v;

    // If discount_code is a posted field rather than query param, include it
    if ("discount_code" in fields || env.discountCode) {
        fields["discount_code"] = env.discountCode;
    }

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);

    console.log(`[${new Date().toISOString()}] POST ${action} (confirm_service)`);
    const postResp = await client.post(action, body.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": env.base,
            "Referer": confirmGetUrl,
        },
        maxRedirects: 10,
    });

    if (postResp.status >= 400) {
        throw new Error(`Confirm form POST failed with status ${postResp.status}`);
    }

    // Heuristic success checks
    const html = String(postResp.data || "");
    const successIndicators = [
        "confirmed",
        "success",
        "submitted",
        "thank you",
    ];
    const isLikelySuccess = successIndicators.some((kw) => html.toLowerCase().includes(kw));

    if (!isLikelySuccess && debugHtml) {
        try {
            const postSnap = path.join(os.tmpdir(), `plan-changer-confirm-post-${Date.now()}.html`);
            await fsp.writeFile(postSnap, html.slice(0, 200000));
            console.log(`[${new Date().toISOString()}] Saved POST response snapshot: ${postSnap}`);
        } catch { }
    }

    console.log(
        `[${new Date().toISOString()}] Confirm POST completed (status ${postResp.status}). Likely success: ${isLikelySuccess ? "yes" : "unknown"}`
    );
}

// ---- Lock helpers ----

async function acquireLock(): Promise<boolean> {
    try {
        const payload = JSON.stringify(
            { pid: process.pid, startedAt: new Date().toISOString() },
            null,
            2
        );
        // 'wx' => fail if the file already exists (atomic)
        await fsp.writeFile(LOCK_FILE, payload, { flag: "wx" });
        lockAcquired = true;
        return true;
    } catch (err: any) {
        if (err && (err.code === "EEXIST" || err.code === "EACCES")) {
            return false;
        }
        throw err;
    }
}

function releaseLockSync(): void {
    if (!lockAcquired) return;
    try {
        fsSync.unlinkSync(LOCK_FILE);
    } catch {
        // ignore
    } finally {
        lockAcquired = false;
    }
}

// Ensure lock is released on termination signals
process.on("SIGINT", () => {
    releaseLockSync();
    process.exit(130);
});
process.on("SIGTERM", () => {
    releaseLockSync();
    process.exit(143);
});
process.on("exit", () => {
    // Best-effort cleanup on normal exit
    releaseLockSync();
});

// ---- Main ----

async function main(): Promise<void> {
    const gotLock = await acquireLock();
    if (!gotLock) {
        console.log(
            `[${new Date().toISOString()}] Another instance detected via lock file (${LOCK_FILE}). Skipping this run.`
        );
        process.exit(0);
    }

    const env = loadEnvAndArgs();
    console.log(
        `[${new Date().toISOString()}] ${JOB_NAME} started (pid ${process.pid}). Lock: ${LOCK_FILE}`
    );
    console.log(
        `[${new Date().toISOString()}] Using PSID=${env.psid}${env.planUsed ? ` (from plan "${env.planUsed}")` : ""}`
    );

    // Debug: print loaded env (with password redacted) before HTTP client creation
    const envLog = { ...env, password: env.password ? "****REDACTED****" : "" };
    console.log(
        `[${new Date().toISOString()}] Loaded env: ${JSON.stringify(envLog, null, 2)}`
    );

    const client = await createHttpClient(env.base, env.timeoutMs);

    await login(client, env);
    await confirmService(client, env);

    console.log(`[${new Date().toISOString()}] ${JOB_NAME} completed successfully.`);
}

main().catch((err) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
    releaseLockSync();
    process.exit(1);
});
