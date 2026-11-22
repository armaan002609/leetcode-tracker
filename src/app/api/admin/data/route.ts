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
          assignedUser: {
            select: { id: true, username: true }
          },
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

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { branch, section, newMentor } = body;

    if (!section || !String(section).trim()) {
      return NextResponse.json({ error: 'Section is required' }, { status: 400 });
    }

    if (!newMentor || !String(newMentor).trim()) {
      return NextResponse.json({ error: 'New Mentor name is required' }, { status: 400 });
    }

    const trimmedSection = String(section).trim();
    const cleanSection = trimmedSection.replace(/^(sec|section)\s*/i, '').trim();
    const trimmedMentor = String(newMentor).trim();

    // Match section robustly whether stored as "B", "Sec B", "Section B" etc.
    const sectionConditions: any[] = [
      { section: { equals: trimmedSection, mode: 'insensitive' } },
      { section: { equals: cleanSection, mode: 'insensitive' } },
      { section: { contains: cleanSection, mode: 'insensitive' } },
    ];

    const where: any = {
      OR: sectionConditions,
    };

    if (branch && branch !== 'All Branches' && String(branch).trim() !== '') {
      where.branch = { equals: String(branch).trim(), mode: 'insensitive' };
    }

    const updated = await prisma.student.updateMany({
      where,
      data: {
        mentor: trimmedMentor,
      },
    });

    return NextResponse.json({
      success: true,
      count: updated.count,
      message: `Updated mentor to "${trimmedMentor}" for ${updated.count} student(s) in Section ${trimmedSection}${
        branch && branch !== 'All Branches' ? ` (${branch})` : ''
      }.`,
    });
  } catch (error: any) {
    console.error('Error updating section mentors:', error);
    return NextResponse.json({ error: error.message || 'Failed to update section mentors' }, { status: 500 });
  }
}
