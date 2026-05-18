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
      console.log("Processing delivery", d);
      console.log("Delivery keys:", Object.keys(deliveries[d]));
      
      const visits = deliveries[d].MonitoredStopVisit || [];
      console.log("Visits in delivery", d, ":", visits.length);

      if (visits.length === 0) {
        console.log("No visits in delivery", d);
        continue;
      }

      for (let v = 0; v < visits.length; v++) {
        console.log("Processing visit", v);
        const visit = visits[v];
        console.log("Visit keys:", Object.keys(visit));
        
        const journey = visit.MonitoredVehicleJourney;
        console.log("Journey exists:", !!journey);
        
        if (!journey) {
          console.log("No journey in visit", v);
          continue;
        }

        console.log("Journey keys:", Object.keys(journey));

        const lineRef = journey.LineRef || "";
        console.log("LineRef:", lineRef);

        if (lineRef.indexOf("M7") === -1 && lineRef.indexOf("M11") === -1) {
          console.log("Not M7 or M11, skipping");
          continue;
        }

        let routeName = lineRef.indexOf("M7") !== -1 ? "M7" : "M11";
        console.log("Route:", routeName);

        const onwardCalls = journey.OnwardCalls && journey.OnwardCalls.OnwardCall;
        console.log("OnwardCalls:", !!onwardCalls, "length:", onwardCalls ? onwardCalls.length : 0);
        
        if (!onwardCalls || onwardCalls.length === 0) {
          console.log("No onward calls");
          continue;
        }

        const arrivalStr = onwardCalls[0].ExpectedArrivalTime || onwardCalls[0].AimedArrivalTime;
        console.log("Arrival string:", arrivalStr);
        
        if (!arrivalStr) {
          console.log("No arrival time");
          continue;
        }

        const arrivalTime = new Date(arrivalStr);
        const mins = Math.round((arrivalTime - now) / 60000);
        console.log("Minutes:", mins);

        if (mins >= 0 && mins <= 60) {
          const color = routeName === "M7" ? "green" : "purple";
          results.push({
            name: routeName + " Southbound",
            mins: mins,
            color: color,
            type: "bus"
          });
          console.log("Added result");
        }
      }
    }

    console.log("Found", results.length, "arrivals");
  } catch (e) {
    console.error("Fetch error:", e.message, e.stack);
  }

  return results;
}
