export async function handler(event, context) {
  try {
    const results = [];

    // Fetch bus data from MTA Bus Time API
    try {
      const busArrivals = await fetchBusArrivals();
      console.log("Bus arrivals fetched:", busArrivals.length);
      results.push(...busArrivals);
    } catch (e) {
      console.error("Error fetching bus data:", e.message);
    }

    // Add subway test data
    const subwayData = [
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
    results.push(...subwayData);

    console.log("Total results:", results.length);

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

async function fetchBusArrivals() {
  const results = [];
  const apiKey = "7fddba21-a132-455a-a0e8-52317c61421a";
  
  const stopIds = ["400969", "400970"];
  
  for (const stopId of stopIds) {
    try {
      const url = "https://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=" + apiKey + "&MonitoringRef=" + stopId;
      
      console.log("Fetching bus data from stop:", stopId);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log("Bus API status:", response.status);
        continue;
      }

      const data = await response.json();
      const busData = parseBusData(data);
      console.log("Parsed", busData.length, "arrivals from stop", stopId);
      results.push(...busData);
    } catch (e) {
      console.error("Error with stop", stopId, ":", e.message);
    }
  }

  return results;
}

function parseBusData(data) {
  const results = [];

  try {
    if (!data || !data.Siri || !data.Siri.ServiceDelivery) {
      return results;
    }

    const deliveries = data.Siri.ServiceDelivery.StopMonitoringDelivery;
    if (!deliveries) {
      return results;
    }

    const now = new Date();

    for (let i = 0; i < deliveries.length; i++) {
      const delivery = deliveries[i];
      const visits = delivery.MonitoredStopVisit;
      if (!visits) continue;

      for (let j = 0; j < visits.length; j++) {
        const visit = visits[j];
        const journey = visit.MonitoredVehicleJourney;
        
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

        const onwardCalls = journey.OnwardCalls;
        if (!onwardCalls || !onwardCalls.OnwardCall || onwardCalls.OnwardCall.length === 0) {
          continue;
        }

        const nextStop = onwardCalls.OnwardCall[0];
        const arrivalTimeStr = nextStop.ExpectedArrivalTime || nextStop.AimedArrivalTime;
        
        if (!arrivalTimeStr) continue;

        const arrivalTime = new Date(arrivalTimeStr);
        const minsUntilArrival = Math.round((arrivalTime - now) / 60000);

        if (minsUntilArrival >= 0 && minsUntilArrival <= 60) {
          results.push({
            name: lineName + " Southbound",
            mins: minsUntilArrival,
            color: lineName === "M7" ? "green" : "purple",
            type: "bus"
          });
        }
      }
    }
  } catch (e) {
    console.error("Parse error:", e.message);
  }

  return results;
}
