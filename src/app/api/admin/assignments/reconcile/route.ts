import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reconcileAllAssignments } from '@/lib/scraping/titleNormalizer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await reconcileAllAssignments();
    return NextResponse.json({ 
      message: `Reconciliation complete. Checked ${result.checked} pending assignments, updated ${result.reconciled} to completed.`,
      ...result 
    });
  } catch (error: any) {
    console.error('Error in reconcile route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
