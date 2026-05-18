export async function handler(event, context) {
  try {
    // Return test data for 1, A, B, C, D trains
    const testData = [
      { name: "1 ↑", mins: 3 },
      { name: "1 ↓", mins: 7 },
      { name: "A ↑", mins: 4 },
      { name: "A ↓", mins: 9 },
      { name: "B/C ↑", mins: 5 },
      { name: "B/C ↓", mins: 12 },
      { name: "D ↑", mins: 6 },
      { name: "D ↓", mins: 14 }
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
