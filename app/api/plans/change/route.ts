import { NextRequest, NextResponse } from 'next/server';
import { changePlan } from '@/lib/services/plan-changer';
import { getSettings, addLog } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { psid } = body;

    if (!psid) {
      return NextResponse.json(
        { error: 'PSID is required' },
        { status: 400 }
      );
    }

    // Get settings from database
    const settings = getSettings();
    if (!settings) {
      return NextResponse.json(
        { error: 'Settings not configured. Please configure your Launtel credentials first.' },
        { status: 400 }
      );
    }

    // Execute plan change
    const result = await changePlan({
      base: settings.base,
      username: settings.username,
      password: settings.password,
      userId: settings.userId,
      serviceId: settings.serviceId,
      avcId: settings.avcId,
      locId: settings.locId,
      discountCode: settings.discountCode,
      unpause: settings.unpause,
      coat: settings.coat,
      churn: settings.churn,
      scheduledDt: settings.scheduledDt,
      newServicePaymentOption: settings.newServicePaymentOption,
      timeoutMs: settings.timeoutMs,
      psid: psid.toString(),
    });

    // Log the result
    addLog({
      success: result.success,
      message: result.message,
      planName: result.planName,
      psid: result.psid,
      timestamp: result.timestamp,
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Log the error
    addLog({
      success: false,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
