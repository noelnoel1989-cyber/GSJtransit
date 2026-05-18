export async function handler() {
  const url =
    "https://api-endpoint.example-gtfs-proxy.com/nyc/subway-and-bus";

  try {
    const res = await fetch(url);
    const data = await res.json();

    // normalize into your format
    const results = (data || []).map(d => ({
      line: d.line,
      mins: d.minutes
    }));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(results)
    };

  } catch (e) {
    return {
      statusCode: 200,
      body: JSON.stringify([])
    };
  }
}
