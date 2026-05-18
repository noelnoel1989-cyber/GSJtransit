export async function handler(event, context) {
  try {
    const results = [];

    // Fetch real bus data from MTA Bus Time API
    try {
      const busData = await fetchBusData();
      console.log("Bus data fetched:", busData.length);
      results.push(...busData);
    } catch (e) {
      console.error("Bus error:", e.message);
    }

    console.log("Returning", results.length, "results");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(results)
    };
  } catch (e) {
    console.error("Handler error:", e.message);
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

async function fetchBusData() {
  const results = [];
  const apiKey = "7fddba21-a132-455a-a0e8-52317c61421a";
  const now = new Date();

  // Stop codes for buses at 86th St
  const stops = [
    { code: "401094", lines: ["M7", "M11"] },  // Columbus & 86th
    { code: "401897", lines: ["M86"] }         // Amsterdam & 86th
  ];

  for (let i = 0; i < stops.length; i++) {
    try {
      const stop = stops[i];
      const url = "https://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=" + apiKey + "&MonitoringRef=" + stop.code;

      console.log("Fetching bus stop:", stop.code);
      const response = await fetch(url);

      if (response.status !== 200) {
        console.log("Status:", response.status);
        continue;
      }

      const data = await response.json();

      if (data && data.Siri && data.Siri.ServiceDelivery && data.Siri.ServiceDelivery.StopMonitoringDelivery) {
        const deliveries = data.Siri.ServiceDelivery.StopMonitoringDelivery;

        for (let d = 0; d < deliveries.length; d++) {
          const visits = deliveries[d].MonitoredStopVisit || [];

          for (let v = 0; v < visits.length; v++) {
            const visit = visits[v];
            const journey = visit.MonitoredVehicleJourney;

            if (!journey) continue;

            const lineRef = journey.LineRef || "";
            let routeName = "";

            for (let l = 0; l < stop.lines.length; l++) {
              if (lineRef.indexOf(stop.lines[l]) !== -1) {
                routeName = stop.lines[l];
                break;
              }
            }

            if (!routeName) continue;

            const onwardCalls = journey.OnwardCalls && journey.OnwardCalls.OnwardCall;
            if (!onwardCalls || onwardCalls.length === 0) continue;

            const arrivalStr = onwardCalls[0].ExpectedArrivalTime || onwardCalls[0].AimedArrivalTime;
            if (!arrivalStr) continue;

            const arrivalTime = new Date(arrivalStr);
            const mins = Math.round((arrivalTime - now) / 60000);

            if (mins >= 0 && mins <= 60) {
              const color = routeName === "M7" ? "green" : (routeName === "M11" ? "purple" : "yellow");
              const direction = routeName === "M86" ? "Eastbound" : "Southbound";

              results.push({
                name: routeName + " " + direction,
                mins: mins,
                color: color,
                type: "bus"
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Stop error:", e.message);
    }
  }

  console.log("Bus results:", results.length);
  return results;
}
