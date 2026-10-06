const { scrapeProfile } = require('./src/lib/scraping/scrapeProfile.ts');

async function main() {
  const result = await scrapeProfile('https://leetcode.com/u/Mayank_vats_002/');
  console.log(result);
}
main();
