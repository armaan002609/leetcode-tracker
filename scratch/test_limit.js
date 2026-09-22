const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
    }
  }
`;

async function test(limit) {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: RECENT_SUBMISSIONS_QUERY,
      variables: { username: 'alfa_coder', limit }
    })
  });
  
  const data = await response.json();
  const subs = data.data.recentAcSubmissionList;
  console.log(`Limit ${limit} returned: ${subs ? subs.length : 0} items`);
}

test(20).then(() => test(50)).then(() => test(100)).catch(console.error);
