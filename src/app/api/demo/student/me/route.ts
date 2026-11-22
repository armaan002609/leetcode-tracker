import { NextResponse } from 'next/server';
import { MOCK_DEMO_STUDENT_PORTAL } from '@/lib/demoData';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(MOCK_DEMO_STUDENT_PORTAL);
}

export async function POST() {
  return NextResponse.json({ error: "Demo mode is read-only. Action disabled." }, { status: 403 });
}
