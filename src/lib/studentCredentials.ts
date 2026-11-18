import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

let tableEnsured = false;

/**
 * Safely ensures the StudentCredential table and its indexes exist in PostgreSQL.
 * This prevents runtime errors on Vercel deployments where `prisma db push` is not
 * run automatically during build.
 */
export async function ensureStudentCredentialTable(): Promise<void> {
  if (tableEnsured) return;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StudentCredential" (
        "id" TEXT NOT NULL,
        "portalUsername" TEXT NOT NULL,
        "enrollmentNo" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "isLocked" BOOLEAN NOT NULL DEFAULT false,
        "studentName" TEXT,
        "stream" TEXT,
        "semester" TEXT,
        "section" TEXT,
        "labBatch" TEXT,
        "studentId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StudentCredential_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudentCredential"
      ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "StudentCredential_portalUsername_key"
      ON "StudentCredential"("portalUsername");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "StudentCredential_studentId_key"
      ON "StudentCredential"("studentId");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StudentCredential_enrollmentNo_idx"
      ON "StudentCredential"("enrollmentNo");
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'StudentCredential_studentId_fkey'
        ) THEN
          ALTER TABLE "StudentCredential"
          ADD CONSTRAINT "StudentCredential_studentId_fkey"
          FOREIGN KEY ("studentId") REFERENCES "Student"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    tableEnsured = true;
  } catch (err) {
    console.error('Error ensuring StudentCredential table:', err);
    throw err;
  }
}

/**
 * Fast, cryptographically strong password hashing using Node native scrypt.
 * Suitable for bulk student credential uploads inside serverless timeouts.
 */
export function hashPortalPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password.trim(), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export async function verifyPortalPassword(password: string, storedHash: string): Promise<boolean> {
  const cleanPassword = password.trim();
  if (!cleanPassword || !storedHash) return false;

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    try {
      const derivedBuf = crypto.scryptSync(cleanPassword, salt, 32, { N: 16384, r: 8, p: 1 });
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (derivedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(derivedBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  // Fallback for bcrypt hashes if any exist
  try {
    return await bcrypt.compare(cleanPassword, storedHash);
  } catch {
    return false;
  }
}

/**
 * Find the matching Student record for a given Roll No + Enrollment No pair.
 * Many existing rosters store Enrollment No in Student.rollNumber, while others
 * may store University Roll No. We check Enrollment No first, then Roll No.
 */
export async function findMatchingStudentId(
  portalUsername: string,
  enrollmentNo: string
): Promise<string | null> {
  const cleanEnroll = enrollmentNo.trim();
  const cleanRoll = portalUsername.trim();

  if (cleanEnroll) {
    const byEnrollment = await prisma.student.findFirst({
      where: { rollNumber: { equals: cleanEnroll, mode: 'insensitive' } },
      select: { id: true },
    });
    if (byEnrollment) return byEnrollment.id;
  }

  if (cleanRoll && cleanRoll.toLowerCase() !== cleanEnroll.toLowerCase()) {
    const byRoll = await prisma.student.findFirst({
      where: { rollNumber: { equals: cleanRoll, mode: 'insensitive' } },
      select: { id: true },
    });
    if (byRoll) return byRoll.id;
  }

  return null;
}
