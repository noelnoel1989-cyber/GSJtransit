export async function handler(event, context) {
  try {
    // Return test data for 1, A, B, C, D trains with uptown/downtown
    const testData = [
      { name: "1 Uptown", mins: 3, color: "red" },
      { name: "1 Downtown", mins: 7, color: "red" },
      { name: "A Uptown", mins: 4, color: "blue" },
      { name: "A Downtown", mins: 9, color: "blue" },
      { name: "B Uptown", mins: 5, color: "orange" },
      { name: "B Downtown", mins: 12, color: "orange" },
      { name: "C Uptown", mins: 8, color: "blue" },
      { name: "C Downtown", mins: 11, color: "blue" },
      { name: "D Uptown", mins: 6, color: "orange" },
      { name: "D Downtown", mins: 14, color: "orange" }
    ];

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testData)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: e.message })
    };
  }
}
