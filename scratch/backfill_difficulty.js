const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('Fetching difficulty map...');
  const res = await fetch('https://leetcode.com/api/problems/algorithms/');
  const data = await res.json();
  const map = {};
  for (const item of data.stat_status_pairs) {
    const slug = item.stat.question__title_slug;
    const level = item.difficulty.level;
    map[slug] = level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard';
  }
  
  console.log('Fetching submissions with missing difficulty...');
  const submissions = await prisma.submission.findMany({
    where: { difficulty: null }
  });
  
  console.log(`Found ${submissions.length} submissions to update.`);
  let updated = 0;
  for (const sub of submissions) {
    const diff = map[sub.titleSlug] || 'Unknown';
    await prisma.submission.update({
      where: { id: sub.id },
      data: { difficulty: diff }
    });
    updated++;
  }
  console.log(`Updated ${updated} submissions.`);
}

backfill().catch(console.error).finally(() => prisma.$disconnect());
