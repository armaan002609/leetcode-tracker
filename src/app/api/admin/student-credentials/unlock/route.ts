import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  PORTAL_UNLOCK_COOKIE,
  createPortalUnlockToken,
  getUnlockCookieOptions,
  isPortalUploadUnlocked,
  isUsingDedicatedPortalPassword,
  verifyPortalLockPassword,
} from '@/lib/portalLock';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin privileges required.' }, { status: 401 });
    }

    const unlocked = await isPortalUploadUnlocked();
    return NextResponse.json({
      unlocked,
      usingDedicatedPassword: isUsingDedicatedPortalPassword(),
    });
  } catch (error: any) {
    console.error('Error checking portal lock status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin privileges required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    if (!password) {
      return NextResponse.json({ error: 'Please enter the lock password.' }, { status: 400 });
    }

    if (!verifyPortalLockPassword(password)) {
      return NextResponse.json({ error: 'Incorrect lock password. Please try again.' }, { status: 403 });
    }

    const token = createPortalUnlockToken();
    const cookieOpts = getUnlockCookieOptions();

    const response = NextResponse.json({
      success: true,
      unlocked: true,
      message: 'Student Portal Access unlocked.',
    });

    response.cookies.set(cookieOpts.name, token, {
      httpOnly: cookieOpts.httpOnly,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      secure: cookieOpts.secure,
      maxAge: cookieOpts.maxAge,
    });

    return response;
  } catch (error: any) {
    console.error('Error unlocking student portal upload:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin privileges required.' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      unlocked: false,
      message: 'Student Portal Access locked.',
    });

    response.cookies.set(PORTAL_UNLOCK_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error('Error locking student portal upload:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
