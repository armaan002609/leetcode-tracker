import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Get all users
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: { students: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a new user
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username, password } = await req.json();

    if (!username || !password || password.length < 6) {
      return NextResponse.json({ error: 'Invalid username or password (min 6 chars)' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'user'
      },
      select: { id: true, username: true, role: true }
    });

    return NextResponse.json({ message: 'User created successfully', user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update a user's password
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Invalid user or password (min 6 chars)' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete a user
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
