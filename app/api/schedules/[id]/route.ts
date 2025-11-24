import { NextRequest, NextResponse } from 'next/server';
import { updateSchedule, deleteSchedule } from '@/lib/db';

// Helper function to validate timezone
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await params;
    const id = parseInt(idString);
    const body = await request.json();

    // Validate hour and minute if provided
    if (body.hour !== undefined && (body.hour < 0 || body.hour > 23)) {
      return NextResponse.json(
        { error: 'Hour must be between 0 and 23' },
        { status: 400 }
      );
    }

    if (body.minute !== undefined && (body.minute < 0 || body.minute > 59)) {
      return NextResponse.json(
        { error: 'Minute must be between 0 and 59' },
        { status: 400 }
      );
    }

    // Validate timezone if provided
    if (body.timezone !== undefined && !isValidTimezone(body.timezone)) {
      return NextResponse.json(
        { error: `Invalid timezone: ${body.timezone}` },
        { status: 400 }
      );
    }

    updateSchedule(id, body);

    return NextResponse.json({
      success: true,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await params;
    const id = parseInt(idString);
    deleteSchedule(id);

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
