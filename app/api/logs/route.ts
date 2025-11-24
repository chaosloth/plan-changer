import { NextRequest, NextResponse } from 'next/server';
import { getLogs, clearLogs } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');

    const logs = getLogs(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearLogs();
    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
