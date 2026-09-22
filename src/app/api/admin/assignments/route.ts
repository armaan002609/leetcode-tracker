import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// We should use next-auth session to get the admin, but for now we might not have it configured fully.
// If authOptions is not exported, we'll just fetch a default user or assume the first one.
// Let's try to find an admin user. If not, fallback to any user for demonstration.

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, title, targetBranch, targetSection } = body;

    if (!url) {
      return NextResponse.json({ error: 'LeetCode URL is required' }, { status: 400 });
    }

    // Extract titleSlug from URL
    // e.g. https://leetcode.com/problems/two-sum/
    const match = url.match(/problems\/([a-zA-Z0-9-]+)/);
    const titleSlug = match ? match[1] : null;

    if (!titleSlug) {
      return NextResponse.json({ error: 'Invalid LeetCode URL' }, { status: 400 });
    }

    // Find assignedBy user (admin)
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } }) || await prisma.user.findFirst();
    
    if (!adminUser) {
      return NextResponse.json({ error: 'No admin user found to assign this question' }, { status: 500 });
    }

    // Create Assignment
    const assignment = await prisma.assignment.create({
      data: {
        titleSlug,
        title: title || titleSlug,
        targetBranch: targetBranch || null,
        targetSection: targetSection || null,
        assignedById: adminUser.id,
      }
    });

    // Find Target Students
    const filter: any = {};
    if (targetBranch) filter.branch = targetBranch;
    if (targetSection) filter.section = targetSection;

    const students = await prisma.student.findMany({ where: filter });

    // Create StudentAssignments
    if (students.length > 0) {
      const studentAssignmentsData = students.map(student => ({
        studentId: student.id,
        assignmentId: assignment.id,
        status: 'pending'
      }));

      await prisma.studentAssignment.createMany({
        data: studentAssignmentsData,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ 
      message: 'Assignment created successfully', 
      assignment,
      studentsAssigned: students.length
    });

  } catch (error: any) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const assignments = await prisma.assignment.findMany({
      include: {
        assignedBy: {
          select: { username: true }
        },
        _count: {
          select: { studentAssignments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // For each assignment, get the count of completed
    const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
      const completedCount = await prisma.studentAssignment.count({
        where: {
          assignmentId: assignment.id,
          status: 'completed'
        }
      });

      return {
        ...assignment,
        completedCount,
        totalAssigned: assignment._count.studentAssignments
      };
    }));

    return NextResponse.json(enrichedAssignments);
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
