async function test() {
  const res = await fetch('https://leetcode.com/api/problems/all/');
  const data = await res.json();
  console.log(`Found ${data.stat_status_pairs.length} total problems`);
  
  // check if 'customers-who-never-order' is in it
  const match = data.stat_status_pairs.find(i => i.stat.question__title_slug === 'customers-who-never-order');
  console.log('customers-who-never-order:', match ? match.difficulty.level : 'Not found');
}
test().catch(console.error);
