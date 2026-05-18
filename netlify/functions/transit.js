export async function handler() {
  const routes = ["1", "B", "C"];

  async function fetchRoute(route) {
    try {
      const res = await fetch(
        `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs/${route}`
      );

      const text = await res.text();

      // fallback parsing guard (we just ensure response exists)
      if (!text || text.length < 10) return [];

      return [
        {
          name: route,
          mins: Math.floor(Math.random() * 10 + 1) // placeholder until GTFS parsing step 2
        }
      ];

    } catch (e) {
      return [];
    }
  }

  const results = (await Promise.all(routes.map(fetchRoute))).flat();
  results.sort((a, b) => a.mins - b.mins);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(results)
  };
}
