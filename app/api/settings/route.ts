import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, type Settings } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();

    if (!settings) {
      return NextResponse.json({ settings: null });
    }

    // Return settings without password for security
    const { password, ...safeSettings } = settings;
    return NextResponse.json({
      settings: {
        ...safeSettings,
        hasPassword: !!password
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['base', 'username', 'password', 'userId', 'serviceId', 'avcId', 'locId'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const settings: Settings = {
      base: body.base,
      username: body.username,
      password: body.password,
      userId: body.userId,
      serviceId: body.serviceId,
      avcId: body.avcId,
      locId: body.locId,
      discountCode: body.discountCode,
      unpause: body.unpause,
      coat: body.coat,
      churn: body.churn,
      scheduledDt: body.scheduledDt,
      newServicePaymentOption: body.newServicePaymentOption,
      timeoutMs: body.timeoutMs,
    };

    saveSettings(settings);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
