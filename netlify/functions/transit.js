export async function handler(event, context) {
  try {
    // Return test data to verify function works
    const testData = [
      { name: "1 ↑", mins: 3 },
      { name: "1 ↓", mins: 7 },
      { name: "B/C ↑", mins: 5 },
      { name: "B/C ↓", mins: 12 }
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
