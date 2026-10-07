const query = `
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
      }
      badges {
        id
        name
      }
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      userCalendar {
        submissionCalendar
      }
    }
  }
`;

async function main() {
  const res = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://leetcode.com/"
    },
    body: JSON.stringify({
      query,
      variables: { username: "Mayank_vats_002" }
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main();
