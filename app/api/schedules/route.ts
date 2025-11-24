import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, addSchedule, type Schedule } from '@/lib/db';

export async function GET() {
  try {
    const schedules = getSchedules();
    return NextResponse.json({ schedules });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

// Helper function to validate timezone
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.planName || !body.psid || body.hour === undefined || body.minute === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: planName, psid, hour, minute' },
        { status: 400 }
      );
    }

    // Validate hour and minute ranges
    if (body.hour < 0 || body.hour > 23) {
      return NextResponse.json(
        { error: 'Hour must be between 0 and 23' },
        { status: 400 }
      );
    }

    if (body.minute < 0 || body.minute > 59) {
      return NextResponse.json(
        { error: 'Minute must be between 0 and 59' },
        { status: 400 }
      );
    }

    // Validate timezone if provided
    const timezone = body.timezone || 'UTC';
    if (!isValidTimezone(timezone)) {
      return NextResponse.json(
        { error: `Invalid timezone: ${timezone}` },
        { status: 400 }
      );
    }

    const schedule: Schedule = {
      planName: body.planName,
      psid: body.psid.toString(),
      hour: parseInt(body.hour),
      minute: parseInt(body.minute),
      timezone: timezone,
      enabled: body.enabled !== undefined ? body.enabled : true,
    };

    const id = addSchedule(schedule);

    return NextResponse.json({
      success: true,
      message: 'Schedule created successfully',
      id
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    );
  }
}
