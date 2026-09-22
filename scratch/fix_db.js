const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('Fetching all problems map...');
  const res = await fetch('https://leetcode.com/api/problems/all/');
  const data = await res.json();
  const map = {};
  for (const item of data.stat_status_pairs) {
    const slug = item.stat.question__title_slug;
    const level = item.difficulty.level;
    map[slug] = level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard';
  }

  const unknowns = await prisma.submission.findMany({
    where: { difficulty: 'Unknown' },
    select: { titleSlug: true },
    distinct: ['titleSlug']
  });
  
  console.log(`Found ${unknowns.length} unique slugs with Unknown difficulty in DB.`);
  
  let updatedGroups = 0;
  for (const item of unknowns) {
    const diff = map[item.titleSlug];
    if (diff) {
      const uRes = await prisma.submission.updateMany({
        where: { titleSlug: item.titleSlug, difficulty: 'Unknown' },
        data: { difficulty: diff }
      });
      if (uRes.count > 0) updatedGroups++;
    }
  }

  console.log(`Successfully fixed ${updatedGroups} question groups!`);
}

fix().catch(console.error).finally(()=>prisma.$disconnect());
