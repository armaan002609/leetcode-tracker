import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const branch = searchParams.get('branch') || '';
    const section = searchParams.get('section') || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (branch && branch !== 'All Branches') {
      where.branch = branch;
    }
    if (section) {
      where.section = section;
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { rollNumber: 'asc' },
        include: {
          submissions: {
            orderBy: { timestamp: 'desc' }
          }
        }
      }),
      prisma.student.count({ where })
    ]);

    return NextResponse.json({
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error fetching admin data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
