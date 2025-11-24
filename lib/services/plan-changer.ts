/**
 * Launtel Plan Changer Service
 *
 * Provides functions to interact with Launtel's residential portal
 * for automated plan changes.
 */

import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";

// ---- Plan Name -> PSID mapping ----
export const PLAN_TO_PSID_CANONICAL: Record<string, number> = {
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

function normalizePlanName(s: string): string {
    return s.trim().toLowerCase()
        .replace(/[\s]+/g, " ")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, "")
        .replace(/-+/g, "-");
}

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

export function resolvePlanToPsid(planInput: string): { psid: number, canonical: string } | null {
    const norm = normalizePlanName(planInput);
    const canonical = NORMALIZED_TO_CANONICAL[norm];
    if (!canonical) return null;
    return { psid: PLAN_TO_PSID_CANONICAL[canonical], canonical };
}

export function getAllPlans(): { name: string, psid: number }[] {
    return Object.entries(PLAN_TO_PSID_CANONICAL).map(([name, psid]) => ({ name, psid }));
}

// ---- Configuration Types ----

export type PlanChangerConfig = {
    base: string;
    username: string;
    password: string;
    userId: string;
    serviceId: string;
    avcId: string;
    locId: string;
    discountCode?: string;
    unpause?: string;
    coat?: string;
    churn?: string;
    scheduledDt?: string;
    newServicePaymentOption?: string;
    timeoutMs?: number;
    psid: string;
};

export type PlanChangeResult = {
    success: boolean;
    message: string;
    planName?: string;
    psid?: string;
    timestamp: string;
};

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
        validateStatus: () => true,
    });
    const { wrapper } = await import("axios-cookiejar-support");
    return wrapper(instance);
}

function absoluteUrl(base: string, maybeRelative: string | undefined | null): string {
    const action = maybeRelative && maybeRelative.trim().length > 0 ? maybeRelative : "/";
    try {
        return new URL(action, base).toString();
    } catch {
        return action;
    }
}

function collectFormInputs($: cheerio.CheerioAPI, form: any): Record<string, string> {
    const data: Record<string, string> = {};
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

async function login(client: AxiosInstance, config: PlanChangerConfig): Promise<void> {
    const returnUrl = `/service_details?avcid=${encodeURIComponent(config.avcId)}&userid=${encodeURIComponent(config.userId)}`;
    const loginUrl = `/login?return_url=${encodeURIComponent(returnUrl)}`;

    const getResp = await client.get(loginUrl);
    if (getResp.status >= 400) {
        throw new Error(`Login page GET failed with status ${getResp.status}`);
    }

    const $ = cheerio.load(String(getResp.data || ""));
    const formEl = $("form[method='post']").first();
    if (formEl.length === 0) {
        throw new Error("Login form not found on the page");
    }

    const action = absoluteUrl(config.base, formEl.attr("action") || "/login");
    let fields = collectFormInputs($, formEl.get(0));

    const userField = ["username", "email", "user", "login"].find((n) => Object.prototype.hasOwnProperty.call(fields, n)) || "username";
    const passField = ["password", "passwd", "pass"].find((n) => Object.prototype.hasOwnProperty.call(fields, n)) || "password";
    fields[userField] = config.username;
    fields[passField] = config.password;

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);

    const postResp = await client.post(action, body.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": config.base,
            "Referer": new URL(loginUrl, config.base).toString(),
        },
        maxRedirects: 10,
    });

    if (postResp.status >= 400) {
        throw new Error(`Login POST failed with status ${postResp.status}`);
    }
}

function buildConfirmGetUrl(config: PlanChangerConfig): string {
    const qs = new URLSearchParams({
        userid: config.userId,
        psid: config.psid,
        unpause: config.unpause || "0",
        service_id: config.serviceId,
        discount_code: config.discountCode || "",
        avcid: config.avcId,
        locid: config.locId,
        coat: config.coat || "0",
        churn: config.churn || "0",
    });
    return `/confirm_service?${qs.toString()}`;
}

async function confirmService(client: AxiosInstance, config: PlanChangerConfig): Promise<void> {
    const confirmGetPath = buildConfirmGetUrl(config);
    const confirmGetUrl = new URL(confirmGetPath, config.base).toString();

    const getResp = await client.get(confirmGetPath, {
        headers: {
            "Referer": new URL(`/service_details?avcid=${encodeURIComponent(config.avcId)}&userid=${encodeURIComponent(config.userId)}`, config.base).toString(),
        },
    });
    if (getResp.status >= 400) {
        throw new Error(`Confirm page GET failed with status ${getResp.status}`);
    }

    const htmlGet = String(getResp.data || "");
    const $ = cheerio.load(htmlGet);

    const looksLikeLogin =
        $("input[type='password']").length > 0 ||
        $("form[action*='login' i]").length > 0 ||
        /login/i.test($("title").text());

    if (looksLikeLogin) {
        throw new Error("Not authenticated on confirm page (login detected)");
    }

    let formEl = $("form[name='confirm_service']").first();
    if (formEl.length === 0) {
        formEl = $("form[action*='/confirm_service']").first();
    }
    if (formEl.length === 0) {
        formEl = $("form:has(input[name='psid'])").first();
    }
    if (formEl.length === 0) {
        throw new Error("Confirm form not found on the page");
    }

    const action = absoluteUrl(config.base, formEl.attr("action") || "/confirm_service");
    let fields = collectFormInputs($, formEl.get(0));

    const overrides: Record<string, string> = {
        ntdreplace: fields["ntdreplace"] ?? "0",
        ntdupgrade: fields["ntdupgrade"] ?? "0",
        userid: config.userId,
        psid: config.psid,
        locid: config.locId,
        avcid: config.avcId,
        unpause: config.unpause || "0",
        scheduleddt: config.scheduledDt || "",
        coat: config.coat || "0",
        new_service_payment_option: config.newServicePaymentOption || "",
    };
    for (const [k, v] of Object.entries(overrides)) fields[k] = v;

    if ("discount_code" in fields || config.discountCode) {
        fields["discount_code"] = config.discountCode || "";
    }

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);

    const postResp = await client.post(action, body.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": config.base,
            "Referer": confirmGetUrl,
        },
        maxRedirects: 10,
    });

    if (postResp.status >= 400) {
        throw new Error(`Confirm form POST failed with status ${postResp.status}`);
    }

    const html = String(postResp.data || "");
    const successIndicators = ["confirmed", "success", "submitted", "thank you"];
    const isLikelySuccess = successIndicators.some((kw) => html.toLowerCase().includes(kw));

    if (!isLikelySuccess) {
        throw new Error("Plan change confirmation unclear - success indicators not found in response");
    }
}

// ---- Main Service Function ----

export async function changePlan(config: PlanChangerConfig): Promise<PlanChangeResult> {
    const timestamp = new Date().toISOString();

    try {
        const resolved = Object.entries(PLAN_TO_PSID_CANONICAL).find(([_, psid]) => psid === Number(config.psid));
        const planName = resolved ? resolved[0] : undefined;

        const client = await createHttpClient(config.base, config.timeoutMs || 15000);
        await login(client, config);
        await confirmService(client, config);

        return {
            success: true,
            message: "Plan changed successfully",
            planName,
            psid: config.psid,
            timestamp,
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error occurred",
            timestamp,
        };
    }
}
