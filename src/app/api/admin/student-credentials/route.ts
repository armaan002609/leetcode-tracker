import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isPortalUploadUnlocked } from '@/lib/portalLock';
import {
  ensureStudentCredentialTable,
  findMatchingStudentId,
  hashPortalPassword,
} from '@/lib/studentCredentials';

export const dynamic = 'force-dynamic';

interface CredentialRecordInput {
  rollNo: string;
  enrollmentNo: string;
  studentName?: string;
  stream?: string;
  semester?: string;
  section?: string;
  labBatch?: string;
}

async function requireUnlockedAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized. Admin privileges required.' },
      { status: 401 }
    );
  }

  const unlocked = await isPortalUploadUnlocked();
  if (!unlocked) {
    return NextResponse.json(
      { error: 'This section is locked. Please unlock with the lock password first.', locked: true },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const guard = await requireUnlockedAdmin();
    if (guard) return guard;

    await ensureStudentCredentialTable();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'logged_in' | 'never_logged_in' | 'linked' | 'unlinked' | 'locked' | 'unlocked'
    const branch = (searchParams.get('branch') || '').trim();
    const semester = (searchParams.get('semester') || '').trim();
    const section = (searchParams.get('section') || '').trim();

    const baseConditions: any[] = [];

    if (search) {
      baseConditions.push({
        OR: [
          { portalUsername: { contains: search, mode: 'insensitive' } },
          { enrollmentNo: { contains: search, mode: 'insensitive' } },
          { studentName: { contains: search, mode: 'insensitive' } },
          { stream: { contains: search, mode: 'insensitive' } },
          { section: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (branch && branch !== 'all' && branch !== 'All Branches') {
      baseConditions.push({
        OR: [
          { stream: { equals: branch, mode: 'insensitive' } },
          { student: { branch: { equals: branch, mode: 'insensitive' } } }
        ]
      });
    }

    if (semester && semester !== 'all' && semester !== 'All Semesters') {
      const cleanSem = semester.replace(/[^0-9]/g, '');
      baseConditions.push({
        OR: [
          { semester: { equals: semester, mode: 'insensitive' } },
          { semester: { equals: cleanSem, mode: 'insensitive' } },
          { student: { semester: { equals: semester, mode: 'insensitive' } } }
        ]
      });
    }

    if (section && section !== 'all' && section !== 'All Sections') {
      const cleanSec = section.replace(/^(sec|section)\s*/i, '').trim();
      baseConditions.push({
        OR: [
          { section: { equals: section, mode: 'insensitive' } },
          { section: { equals: cleanSec, mode: 'insensitive' } },
          { section: { contains: cleanSec, mode: 'insensitive' } },
          { student: { section: { equals: section, mode: 'insensitive' } } },
          { student: { section: { equals: cleanSec, mode: 'insensitive' } } }
        ]
      });
    }

    const baseWhere: any = baseConditions.length > 0 ? { AND: baseConditions } : {};

    const conditions: any[] = [...baseConditions];
    if (filter === 'logged_in') {
      conditions.push({ lastLoginAt: { not: null } });
    } else if (filter === 'never_logged_in') {
      conditions.push({ lastLoginAt: null });
    } else if (filter === 'linked') {
      conditions.push({ studentId: { not: null } });
    } else if (filter === 'unlinked') {
      conditions.push({ studentId: null });
    } else if (filter === 'locked') {
      conditions.push({ isLocked: true });
    } else if (filter === 'unlocked') {
      conditions.push({ isLocked: false });
    }

    const where: any = conditions.length > 0 ? { AND: conditions } : {};

    const [
      totalCredentials,
      linkedCount,
      lockedCount,
      loggedInCount,
      neverLoggedInCount,
      totalStudents,
      credentials,
      rawStreams,
      rawSemesters,
      rawSections,
      rawStudentBranches,
      rawStudentSemesters,
      rawStudentSections,
    ] = await Promise.all([
      prisma.studentCredential.count({ where: baseWhere }),
      prisma.studentCredential.count({ where: { ...baseWhere, studentId: { not: null } } }),
      prisma.studentCredential.count({ where: { ...baseWhere, isLocked: true } }),
      prisma.studentCredential.count({ where: { ...baseWhere, lastLoginAt: { not: null } } }),
      prisma.studentCredential.count({ where: { ...baseWhere, lastLoginAt: null } }),
      prisma.student.count(),
      prisma.studentCredential.findMany({
        where,
        take: 500,
        orderBy: [{ isLocked: 'desc' }, { portalUsername: 'asc' }],
        select: {
          id: true,
          portalUsername: true,
          enrollmentNo: true,
          isLocked: true,
          lastLoginAt: true,
          loginCount: true,
          studentName: true,
          stream: true,
          semester: true,
          section: true,
          labBatch: true,
          studentId: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              rollNumber: true,
              name: true,
              branch: true,
              semester: true,
              section: true,
              totalSolved: true,
            },
          },
        },
      }),
      prisma.studentCredential.findMany({ select: { stream: true }, distinct: ['stream'] }),
      prisma.studentCredential.findMany({ select: { semester: true }, distinct: ['semester'] }),
      prisma.studentCredential.findMany({ select: { section: true }, distinct: ['section'] }),
      prisma.student.findMany({ select: { branch: true }, distinct: ['branch'] }),
      prisma.student.findMany({ select: { semester: true }, distinct: ['semester'] }),
      prisma.student.findMany({ select: { section: true }, distinct: ['section'] }),
    ]);

    const uniqueStreams = Array.from(new Set([
      ...rawStreams.map(s => s.stream),
      ...rawStudentBranches.map(s => s.branch),
    ].filter(Boolean))).sort();

    const uniqueSemesters = Array.from(new Set([
      ...rawSemesters.map(s => s.semester),
      ...rawStudentSemesters.map(s => s.semester),
    ].filter(Boolean))).sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    const uniqueSections = Array.from(new Set([
      ...rawSections.map(s => s.section),
      ...rawStudentSections.map(s => s.section),
    ].filter(Boolean))).sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    return NextResponse.json({
      totalCredentials,
      linkedCount,
      unlinkedCount: totalCredentials - linkedCount,
      lockedCount,
      unlockedCount: totalCredentials - lockedCount,
      loggedInCount,
      neverLoggedInCount: totalCredentials - loggedInCount,
      totalStudents,
      uniqueStreams,
      uniqueSemesters,
      uniqueSections,
      credentials,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/student-credentials GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireUnlockedAdmin();
    if (guard) return guard;

    await ensureStudentCredentialTable();

    const body = await req.json().catch(() => ({}));

    // Action: Re-link any unlinked credentials to matching Student records
    if (body.action === 'relink') {
      const unlinked = await prisma.studentCredential.findMany({
        where: { studentId: null },
        select: { id: true, portalUsername: true, enrollmentNo: true },
      });

      if (unlinked.length === 0) {
        return NextResponse.json({
          success: true,
          relinkedCount: 0,
          message: 'All student portal credentials are already linked.',
        });
      }

      const allStudents = await prisma.student.findMany({
        select: { id: true, rollNumber: true },
      });
      const existingLinkedIds = new Set(
        (
          await prisma.studentCredential.findMany({
            where: { studentId: { not: null } },
            select: { studentId: true },
          })
        )
          .map((c) => c.studentId)
          .filter((id): id is string => Boolean(id))
      );

      const studentIdByRoll = new Map<string, string>();
      for (const s of allStudents) {
        studentIdByRoll.set(s.rollNumber.trim().toLowerCase(), s.id);
      }

      let relinkedCount = 0;
      for (const cred of unlinked) {
        const matchedId =
          studentIdByRoll.get(cred.enrollmentNo.trim().toLowerCase()) ||
          studentIdByRoll.get(cred.portalUsername.trim().toLowerCase()) ||
          null;

        if (matchedId && !existingLinkedIds.has(matchedId)) {
          await prisma.studentCredential.update({
            where: { id: cred.id },
            data: { studentId: matchedId },
          });
          existingLinkedIds.add(matchedId);
          relinkedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        relinkedCount,
        message: `Linked ${relinkedCount} student portal credential${relinkedCount === 1 ? '' : 's'} to the LeetCode roster.`,
      });
    }

    // Case 1: Bulk upload array { records: [...] }
    if (Array.isArray(body.records)) {
      const rawRecords: CredentialRecordInput[] = body.records;

      // Deduplicate by lowercase Roll No (portalUsername)
      const dedupedMap = new Map<string, CredentialRecordInput>();
      for (const r of rawRecords) {
        const rollNo = String(r.rollNo || '').trim();
        const enrollmentNo = String(r.enrollmentNo || '').trim();
        if (!rollNo || !enrollmentNo) continue;

        dedupedMap.set(rollNo.toLowerCase(), {
          rollNo,
          enrollmentNo,
          studentName: r.studentName ? String(r.studentName).trim() : undefined,
          stream: r.stream ? String(r.stream).trim() : undefined,
          semester: r.semester ? String(r.semester).trim() : undefined,
          section: r.section ? String(r.section).trim() : undefined,
          labBatch: r.labBatch ? String(r.labBatch).trim() : undefined,
        });
      }

      const cleanRecords = Array.from(dedupedMap.values());
      if (cleanRecords.length === 0) {
        return NextResponse.json(
          { error: 'No valid rows found. Each row must have both Roll No and Enrollment No.' },
          { status: 400 }
        );
      }

      // Build lookup map of existing Student records by lowercase rollNumber
      const lookupKeys = new Set<string>();
      for (const rec of cleanRecords) {
        lookupKeys.add(rec.enrollmentNo);
        lookupKeys.add(rec.rollNo);
      }

      const allKeysArray = Array.from(lookupKeys);
      const matchedStudents: Array<{ id: string; rollNumber: string }> = [];
      const QUERY_BATCH = 500;
      for (let i = 0; i < allKeysArray.length; i += QUERY_BATCH) {
        const slice = allKeysArray.slice(i, i + QUERY_BATCH);
        const found = await prisma.student.findMany({
          where: { rollNumber: { in: slice, mode: 'insensitive' } },
          select: { id: true, rollNumber: true },
        });
        matchedStudents.push(...found);
      }

      const studentIdByRoll = new Map<string, string>();
      for (const s of matchedStudents) {
        studentIdByRoll.set(s.rollNumber.trim().toLowerCase(), s.id);
      }

      // Prepare rows with hashed passwords & deduplicated studentId links
      const claimedStudentIds = new Set<string>();
      let linkedCount = 0;
      let unlinkedCount = 0;

      const prepared = cleanRecords.map((rec) => {
        let matchedStudentId =
          studentIdByRoll.get(rec.enrollmentNo.toLowerCase()) ||
          studentIdByRoll.get(rec.rollNo.toLowerCase()) ||
          null;

        if (matchedStudentId && claimedStudentIds.has(matchedStudentId)) {
          matchedStudentId = null;
        }
        if (matchedStudentId) {
          claimedStudentIds.add(matchedStudentId);
          linkedCount++;
        } else {
          unlinkedCount++;
        }

        return {
          id: crypto.randomUUID(),
          portalUsername: rec.rollNo,
          enrollmentNo: rec.enrollmentNo,
          passwordHash: hashPortalPassword(rec.enrollmentNo),
          studentName: rec.studentName || null,
          stream: rec.stream || null,
          semester: rec.semester || null,
          section: rec.section || null,
          labBatch: rec.labBatch || null,
          studentId: matchedStudentId,
        };
      });

      // Clear any stale studentId links held by other portalUsernames to avoid unique constraint conflicts
      const studentIdsToClaim = Array.from(claimedStudentIds);
      const portalUsernames = prepared.map((p) => p.portalUsername);
      if (studentIdsToClaim.length > 0) {
        await prisma.studentCredential.updateMany({
          where: {
            studentId: { in: studentIdsToClaim },
            portalUsername: { notIn: portalUsernames },
          },
          data: { studentId: null },
        });
      }

      // Fast bulk upsert using PostgreSQL INSERT ... ON CONFLICT
      let savedCount = 0;
      const SQL_CHUNK = 100;
      for (let i = 0; i < prepared.length; i += SQL_CHUNK) {
        const chunk = prepared.slice(i, i + SQL_CHUNK);
        try {
          const valueRows = chunk.map(
            (item) => Prisma.sql`(
              ${item.id}::text,
              ${item.portalUsername}::text,
              ${item.enrollmentNo}::text,
              ${item.passwordHash}::text,
              ${item.studentName}::text,
              ${item.stream}::text,
              ${item.semester}::text,
              ${item.section}::text,
              ${item.labBatch}::text,
              ${item.studentId}::text,
              NOW(),
              NOW()
            )`
          );

          await prisma.$executeRaw`
            INSERT INTO "StudentCredential" (
              "id",
              "portalUsername",
              "enrollmentNo",
              "passwordHash",
              "studentName",
              "stream",
              "semester",
              "section",
              "labBatch",
              "studentId",
              "createdAt",
              "updatedAt"
            )
            VALUES ${Prisma.join(valueRows)}
            ON CONFLICT ("portalUsername") DO UPDATE SET
              "enrollmentNo" = EXCLUDED."enrollmentNo",
              "passwordHash" = EXCLUDED."passwordHash",
              "studentName" = COALESCE(EXCLUDED."studentName", "StudentCredential"."studentName"),
              "stream" = COALESCE(EXCLUDED."stream", "StudentCredential"."stream"),
              "semester" = COALESCE(EXCLUDED."semester", "StudentCredential"."semester"),
              "section" = COALESCE(EXCLUDED."section", "StudentCredential"."section"),
              "labBatch" = COALESCE(EXCLUDED."labBatch", "StudentCredential"."labBatch"),
              "studentId" = COALESCE(EXCLUDED."studentId", "StudentCredential"."studentId"),
              "updatedAt" = NOW()
          `;
          savedCount += chunk.length;
        } catch (rawErr) {
          console.warn('Bulk SQL upsert failed, falling back to sequential Prisma upserts:', rawErr);
          for (const item of chunk) {
            await prisma.studentCredential.upsert({
              where: { portalUsername: item.portalUsername },
              update: {
                enrollmentNo: item.enrollmentNo,
                passwordHash: item.passwordHash,
                ...(item.studentName ? { studentName: item.studentName } : {}),
                ...(item.stream ? { stream: item.stream } : {}),
                ...(item.semester ? { semester: item.semester } : {}),
                ...(item.section ? { section: item.section } : {}),
                ...(item.labBatch ? { labBatch: item.labBatch } : {}),
                ...(item.studentId ? { studentId: item.studentId } : {}),
              },
              create: item,
            });
            savedCount++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        savedCount,
        linkedCount,
        unlinkedCount,
        message: `Uploaded ${savedCount} student portal credentials (${linkedCount} linked to roster, ${unlinkedCount} awaiting roster match).`,
      });
    }

    // Case 2: Single manual credential add/update
    const rollNo = String(body.rollNo || '').trim();
    const enrollmentNo = String(body.enrollmentNo || '').trim();

    if (!rollNo || !enrollmentNo) {
      return NextResponse.json(
        { error: 'Both Roll No (username) and Enrollment No (password) are required.' },
        { status: 400 }
      );
    }

    const matchedStudentId = await findMatchingStudentId(rollNo, enrollmentNo);

    if (matchedStudentId) {
      await prisma.studentCredential.updateMany({
        where: {
          studentId: matchedStudentId,
          portalUsername: { not: rollNo },
        },
        data: { studentId: null },
      });
    }

    const saved = await prisma.studentCredential.upsert({
      where: { portalUsername: rollNo },
      update: {
        enrollmentNo,
        passwordHash: hashPortalPassword(enrollmentNo),
        studentName: body.studentName ? String(body.studentName).trim() : undefined,
        stream: body.stream ? String(body.stream).trim() : undefined,
        semester: body.semester ? String(body.semester).trim() : undefined,
        section: body.section ? String(body.section).trim() : undefined,
        labBatch: body.labBatch ? String(body.labBatch).trim() : undefined,
        studentId: matchedStudentId,
      },
      create: {
        portalUsername: rollNo,
        enrollmentNo,
        passwordHash: hashPortalPassword(enrollmentNo),
        studentName: body.studentName ? String(body.studentName).trim() : null,
        stream: body.stream ? String(body.stream).trim() : null,
        semester: body.semester ? String(body.semester).trim() : null,
        section: body.section ? String(body.section).trim() : null,
        labBatch: body.labBatch ? String(body.labBatch).trim() : null,
        studentId: matchedStudentId,
      },
      select: {
        id: true,
        portalUsername: true,
        enrollmentNo: true,
        studentName: true,
        studentId: true,
      },
    });

    return NextResponse.json({
      success: true,
      credential: saved,
      linked: Boolean(saved.studentId),
      message: saved.studentId
        ? `Saved login for ${saved.portalUsername} and linked to student roster.`
        : `Saved login for ${saved.portalUsername} (not yet matched to a student in the LeetCode roster).`,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/student-credentials POST:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const guard = await requireUnlockedAdmin();
    if (guard) return guard;

    await ensureStudentCredentialTable();

    const body = await req.json().catch(() => ({}));
    if (typeof body.isLocked !== 'boolean') {
      return NextResponse.json({ error: 'isLocked boolean is required.' }, { status: 400 });
    }

    const isLocked = body.isLocked;

    // Bulk lock/unlock all student IDs
    if (body.scope === 'all') {
      const result = await prisma.studentCredential.updateMany({
        data: { isLocked },
      });

      return NextResponse.json({
        success: true,
        scope: 'all',
        isLocked,
        updatedCount: result.count,
        message: isLocked
          ? `Locked all ${result.count} student IDs. Students cannot log in until unlocked.`
          : `Unlocked all ${result.count} student IDs. Students can now log in.`,
      });
    }

    // Individual student ID lock/unlock
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Credential id or scope="all" is required.' }, { status: 400 });
    }

    const updated = await prisma.studentCredential.update({
      where: { id },
      data: { isLocked },
      select: {
        id: true,
        portalUsername: true,
        isLocked: true,
      },
    });

    return NextResponse.json({
      success: true,
      credential: updated,
      message: updated.isLocked
        ? `Locked student ID ${updated.portalUsername}.`
        : `Unlocked student ID ${updated.portalUsername}.`,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/student-credentials PATCH:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requireUnlockedAdmin();
    if (guard) return guard;

    await ensureStudentCredentialTable();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');

    if (all === 'true') {
      const result = await prisma.studentCredential.deleteMany();
      return NextResponse.json({
        success: true,
        deletedCount: result.count,
        message: `Removed ${result.count} student portal credentials.`,
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'Credential id is required.' }, { status: 400 });
    }

    await prisma.studentCredential.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Credential deleted.' });
  } catch (error: any) {
    console.error('Error in /api/admin/student-credentials DELETE:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
