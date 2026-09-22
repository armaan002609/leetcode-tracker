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
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const username = 'aayush_dev'; // Let's try some random or known username
  
  // Try getting question status for a specific user
  // This query is usually for authenticated users, but let's test if we can pass a username
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `;
  const result = await fetchGraphQL(query, { username });
  console.log("Stats:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
