const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('Fetching difficulty map...');
  const res = await fetch('https://leetcode.com/api/problems/all/');
  const data = await res.json();
  const map = {};
  for (const item of data.stat_status_pairs) {
    const slug = item.stat.question__title_slug;
    const level = item.difficulty.level;
    map[slug] = level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard';
  }
  
  console.log('Updating submissions in batches by titleSlug...');
  let updatedGroups = 0;
  for (const slug of Object.keys(map)) {
    const res = await prisma.submission.updateMany({
      where: { titleSlug: slug, difficulty: 'Unknown' },
      data: { difficulty: map[slug] }
    });
    if (res.count > 0) {
      updatedGroups++;
    }
  }

  console.log(`Updated ${updatedGroups} problem groups that were Unknown.`);
}

backfill().catch(console.error).finally(() => prisma.$disconnect());
