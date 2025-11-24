import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

async function createHttpClient(baseURL: string, timeoutMs: number) {
  const jar = new CookieJar();
  const instance = axios.create({
    baseURL,
    withCredentials: true,
    // @ts-ignore
    jar,
    timeout: timeoutMs,
    maxRedirects: 10,
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
      }
    });
  return data;
}

async function login(client: any, config: any): Promise<void> {
  const returnUrl = `/service_details?avcid=${encodeURIComponent(config.avcId)}&userid=${encodeURIComponent(config.userId)}`;
  const loginUrl = `/login?return_url=${encodeURIComponent(returnUrl)}`;

  const getResp = await client.get(loginUrl);
  if (getResp.status >= 400) {
    throw new Error(`Login page GET failed with status ${getResp.status}`);
  }

  const $ = cheerio.load(String(getResp.data || ""));
  const formEl = $("form[method='post']").first();
  if (formEl.length === 0) {
    throw new Error("Login form not found");
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

export async function GET() {
  try {
    const settings = getSettings();
    if (!settings) {
      return NextResponse.json(
        { error: 'Settings not configured' },
        { status: 400 }
      );
    }

    const client = await createHttpClient(settings.base, settings.timeoutMs || 15000);

    // Login first
    await login(client, settings);

    // Fetch services page
    const servicesUrl = `/services?userid=${settings.userId}`;
    const servicesResp = await client.get(servicesUrl);

    if (servicesResp.status >= 400) {
      throw new Error(`Services page GET failed with status ${servicesResp.status}`);
    }

    const $ = cheerio.load(String(servicesResp.data || ""));

    // Extract service information
    const serviceCard = $('.service-card').first();

    const serviceName = serviceCard.find('.service-title-txt').text().trim();
    const status = serviceCard.find('.order-status').text().trim();
    const speedTier = serviceCard.find('dt:contains("Technology / Speed Tier")').next('dd').text().trim();
    const dailyPrice = serviceCard.find('dt:contains("Daily Price")').next('dd').text().trim();
    const address = serviceCard.find('dt:contains("Connection address")').next('dd').text().trim().split('\n')[0];
    const ipv4 = serviceCard.find('dt:contains("IPv4")').next('dd').text().trim();
    const ipv6Prefix = serviceCard.find('dt:contains("IPv6 Prefix")').next('dd').text().trim();

    // Extract balance information
    const balance = $('.balance-dl').find('dt:contains("Current Balance")').next('dd').find('span').text().trim();
    const todayCharge = $('.balance-dl').find('dt:contains("Today\'s Charge")').next('dd').find('span').text().trim();
    const tomorrowCharge = $('.balance-dl').find('dt:contains("Tomorrow\'s Charge")').next('dd').find('span').text().trim();
    const daysRemaining = $('.balance-dl').find('dt:contains("Estimated Days Remaining")').next('dd').find('span').text().trim();

    return NextResponse.json({
      success: true,
      service: {
        name: serviceName,
        status,
        speedTier,
        dailyPrice,
        address,
        ipv4,
        ipv6Prefix,
      },
      balance: {
        current: balance,
        todayCharge,
        tomorrowCharge,
        daysRemaining,
      },
    });
  } catch (error) {
    console.error('Error fetching current plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch current plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
