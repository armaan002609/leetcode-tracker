const https = require('https');

function fetchGraphQL(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'leetcode.com',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const username = 'neal_wu'; // A known competitive programmer on Leetcode
  
  // Test 1: Recent submissions
  const recentSubmissionsQuery = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;
  const recent = await fetchGraphQL(recentSubmissionsQuery, { username, limit: 5 });
  console.log("Recent Submissions:", JSON.stringify(recent, null, 2));

  // Test 2: User Profile to see if it exposes specific question status
  // Are there any other queries? Like "userQuestionStatus"?
}

main().catch(console.error);
