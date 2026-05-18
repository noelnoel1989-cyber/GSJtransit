export async function handler(event, context) {
  try {
    const results = [];

    try {
      const data = await fetchTransitlandData();
      results.push(...data);
    } catch (e) {
      console.error("Transitland error:", e.message);
    }

    // Fallback test data
    if (results.length === 0) {
      results.push(
        { name: "1 Uptown", mins: 3, color: "red", type: "subway" },
        { name: "1 Downtown", mins: 7, color: "red", type: "subway" },
        { name: "A Uptown", mins: 4, color: "blue", type: "subway" },
        { name: "A Downtown", mins: 9, color: "blue", type: "subway" },
        { name: "B Uptown", mins: 5, color: "orange", type: "subway" },
        { name: "B Downtown", mins: 12, color: "orange", type: "subway" },
        { name: "C Uptown", mins: 8, color: "blue", type: "subway" },
        { name: "C Downtown", mins: 11, color: "blue", type: "subway" },
        { name: "D Uptown", mins: 6, color: "orange", type: "subway" },
        { name: "D Downtown", mins: 14, color: "orange", type: "subway" },
        { name: "M7 Southbound", mins: 4, color: "green", type: "bus" },
        { name: "M7 Southbound", mins: 10, color: "green", type: "bus" },
        { name: "M11 Southbound", mins: 6, color: "purple", type: "bus" },
        { name: "M11 Southbound", mins: 13, color: "purple", type: "bus" },
        { name: "M86 Eastbound", mins: 5, color: "yellow", type: "bus" },
        { name: "M86 Eastbound", mins: 12, color: "yellow", type: "bus" }
      );
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(results)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message })
    };
  }
}

async function fetchTransitlandData() {
  const results = [];
  const now = new Date();

  // Search for stops near 86th St and Columbus Ave
  try {
    console.log("Searching for stops...");
    const searchUrl = "https://api.transit.land/v2/stops?lat=40.7865&lon=-73.9736&radius_meters=500";
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.log("Search failed:", searchResponse.status);
      return results;
    }

    const searchData = await searchResponse.json();
    console.log("Found stops:", searchData.stops ? searchData.stops.length : 0);

    if (!searchData.stops) {
      return results;
    }

    // Get departures for each stop
    for (let i = 0; i < searchData.stops.length; i++) {
      const stop = searchData.stops[i];
      console.log("Stop:", stop.name);

      try {
        const departuresUrl = "https://api.transit.land/v2/stops/" + stop.id + "/departures?limit=30";
        const depResponse = await fetch(departuresUrl);

        if (!depResponse.ok) continue;

        const depData = await depResponse.json();

        if (depData.departures && Array.isArray(depData.departures)) {
          for (let d = 0; d < depData.departures.length; d++) {
            const dep = depData.departures[d];

            if (!dep.trip || !dep.trip.route) continue;

            const routeName = dep.trip.route.short_name || dep.trip.route.long_name || "";
            const arrivalTime = dep.estimated_departure_at || dep.scheduled_departure_at;

            if (!arrivalTime) continue;

            const arrival = new Date(arrivalTime);
            const mins = Math.round((arrival - now) / 60000);

            if (mins >= 0 && mins <= 60) {
              results.push({
                name: routeName,
                mins: mins,
                color: getRouteColor(routeName),
                type: "bus"
              });
            }
          }
        }
      } catch (e) {
        console.error("Error fetching departures:", e.message);
      }
    }
  } catch (e) {
    console.error("Search error:", e.message);
  }

  console.log("Transitland results:", results.length);
  return results;
}

function getRouteColor(routeName) {
  if (routeName.indexOf("M7") !== -1) return "green";
  if (routeName.indexOf("M11") !== -1) return "purple";
  if (routeName.indexOf("M86") !== -1) return "yellow";
  if (routeName.indexOf("1") !== -1) return "red";
  if (routeName.indexOf("A") !== -1 || routeName.indexOf("C") !== -1) return "blue";
  if (routeName.indexOf("B") !== -1 || routeName.indexOf("D") !== -1) return "orange";
  return "gray";
}
