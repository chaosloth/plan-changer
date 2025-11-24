import { NextResponse } from 'next/server';
import { getAllPlans } from '@/lib/services/plan-changer';

export async function GET() {
  try {
    const plans = getAllPlans();
    return NextResponse.json({ plans });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}
