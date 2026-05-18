export async function handler(event, context) {
  try {
    const results = [];

    // Fetch real bus data
    try {
      const busData = await fetchBusData();
      console.log("Bus data fetched:", busData.length);
      results.push(...busData);
    } catch (e) {
      console.error("Bus error:", e.message);
    }

    // Add test data for subways
    const subwayTest = [
      { name: "1 Uptown", mins: 3, color: "red", type: "subway" },
      { name: "1 Uptown", mins: 8, color: "red", type: "subway" },
      { name: "1 Downtown", mins: 7, color: "red", type: "subway" },
      { name: "1 Downtown", mins: 15, color: "red", type: "subway" },
      { name: "A Uptown", mins: 4, color: "blue", type: "subway" },
      { name: "A Uptown", mins: 11, color: "blue", type: "subway" },
      { name: "A Downtown", mins: 9, color: "blue", type: "subway" },
      { name: "A Downtown", mins: 18, color: "blue", type: "subway" },
      { name: "B Uptown", mins: 5, color: "orange", type: "subway" },
      { name: "B Uptown", mins: 12, color: "orange", type: "subway" },
      { name: "B Downtown", mins: 12, color: "orange", type: "subway" },
      { name: "B Downtown", mins: 20, color: "orange", type: "subway" },
      { name: "C Uptown", mins: 8, color: "blue", type: "subway" },
      { name: "C Uptown", mins: 16, color: "blue", type: "subway" },
      { name: "C Downtown", mins: 11, color: "blue", type: "subway" },
      { name: "C Downtown", mins: 22, color: "blue", type: "subway" },
      { name: "D Uptown", mins: 6, color: "orange", type: "subway" },
      { name: "D Uptown", mins: 14, color: "orange", type: "subway" },
      { name: "D Downtown", mins: 14, color: "orange", type: "subway" },
      { name: "D Downtown", mins: 25, color: "orange", type: "subway" }
    ];
    results.push(...subwayTest);

    console.log("Returning", results.length, "total results");

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
  const stopIds = ["400969", "400970"];
  const now = new Date();

  for (let i = 0; i < stopIds.length; i++) {
    try {
      const stopId = stopIds[i];
      const url = "https://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=" + apiKey + "&MonitoringRef=" + stopId;

      console.log("Fetching bus stop:", stopId);
      const response = await fetch(url);
      console.log("Response status:", response.status);

      if (!response.ok) {
        console.log("Skipping stop", stopId);
        continue;
      }

      const data = await response.json();

      if (data.Siri && data.Siri.ServiceDelivery && data.Siri.ServiceDelivery.StopMonitoringDelivery) {
        const deliveries = data.Siri.ServiceDelivery.StopMonitoringDelivery;

        for (let d = 0; d < deliveries.length; d++) {
          const visits = deliveries[d].MonitoredStopVisit || [];

          for (let v = 0; v < visits.length; v++) {
            const journey = visits[v].MonitoredVehicleJourney;
            if (!journey) continue;

            const lineRef = journey.LineRef || "";
            let lineName = "";

            if (lineRef.indexOf("M7") !== -1) {
              lineName = "M7";
            } else if (lineRef.indexOf("M11") !== -1) {
              lineName = "M11";
            } else {
              continue;
            }

            const onwardCalls = journey.OnwardCalls && journey.OnwardCalls.OnwardCall;
            if (!onwardCalls || onwardCalls.length === 0) continue;

            const arrivalStr = onwardCalls[0].ExpectedArrivalTime || onwardCalls[0].AimedArrivalTime;
            if (!arrivalStr) continue;

            const arrivalTime = new Date(arrivalStr);
            const mins = Math.round((arrivalTime - now) / 60000);

            if (mins >= 0 && mins <= 60) {
              results.push({
                name: lineName + " Southbound",
                mins: mins,
                color: lineName === "M7" ? "green" : "purple",
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

  console.log("Bus data found:", results.length);
  return results;
}
