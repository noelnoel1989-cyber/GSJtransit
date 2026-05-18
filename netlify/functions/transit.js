export async function handler(event, context) {
  try {
    const results = [];

    console.log("Starting bus data fetch");

    const busData = await fetchBusData();
    console.log("Got bus data:", busData.length);
    results.push(...busData);

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
    console.error("Handler error:", e.message, e.stack);
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
  console.log("fetchBusData called");
  const results = [];
  const apiKey = "7fddba21-a132-455a-a0e8-52317c61421a";
  const now = new Date();

  const stopCode = "401094";
  const url = "https://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=" + apiKey + "&MonitoringRef=" + stopCode;

  try {
    console.log("About to fetch:", url);
    const response = await fetch(url);
    console.log("Fetch completed, status:", response.status);

    if (!response.ok) {
      console.log("Response not ok");
      return results;
    }

    const data = await response.json();
    console.log("JSON parsed");

    const deliveries = data.Siri.ServiceDelivery.StopMonitoringDelivery;
    console.log("Deliveries:", deliveries.length);

    for (let d = 0; d < deliveries.length; d++) {
      const visits = deliveries[d].MonitoredStopVisit || [];

      for (let v = 0; v < visits.length; v++) {
        const journey = visits[v].MonitoredVehicleJourney;
        if (!journey) continue;

        const lineRef = journey.LineRef || "";

        if (lineRef.indexOf("M7") === -1 && lineRef.indexOf("M11") === -1) {
          continue;
        }

        let routeName = lineRef.indexOf("M7") !== -1 ? "M7" : "M11";

        const onwardCalls = journey.OnwardCalls && journey.OnwardCalls.OnwardCall;
        if (!onwardCalls || onwardCalls.length === 0) continue;

        const arrivalStr = onwardCalls[0].ExpectedArrivalTime || onwardCalls[0].AimedArrivalTime;
        if (!arrivalStr) continue;

        const arrivalTime = new Date(arrivalStr);
        const mins = Math.round((arrivalTime - now) / 60000);

        if (mins >= 0 && mins <= 60) {
          const color = routeName === "M7" ? "green" : "purple";
          results.push({
            name: routeName + " Southbound",
            mins: mins,
            color: color,
            type: "bus"
          });
        }
      }
    }

    console.log("Found", results.length, "arrivals");
  } catch (e) {
    console.error("Fetch error:", e.message);
  }

  return results;
}
