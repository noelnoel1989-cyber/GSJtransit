export async function handler(event, context) {
  try {
    const results = [];

    // Subway test data
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

    // Fetch bus data from MTA Bus Time API
    try {
      const busArrivals = await fetchBusArrivals();
      results.push(...busArrivals);
    } catch (e) {
      console.error("Error fetching bus data:", e.message);
    }

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
  
  try {
    // Stop ID for Columbus and 84th St
    // M7 and M11 southbound at Columbus and 84th
    const stopIds = ["400969", "400970"]; // Columbus and 84th stop IDs for M7/M11
    
    for (const stopId of stopIds) {
      const url = `http://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=${apiKey}&MonitoringRef=${stopId}&LineRef=MTA%20NYCT_M7,MTA%20NYCT_M11`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Bus API error for stop ${stopId}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const busArrivals = parseBusMonitoring(data);
      results.push(...busArrivals);
    }
  } catch (e) {
    console.error("Error fetching bus arrivals:", e.message);
  }

  return results;
}

function parseBusMonitoring(data) {
  const results = [];

  try {
    if (!data.Siri || !data.Siri.ServiceDelivery) {
      return results;
    }

    const deliveries = data.Siri.ServiceDelivery.StopMonitoringDelivery;
    
    if (!deliveries || deliveries.length === 0) {
      return results;
    }

    const now = new Date();

    deliveries.forEach(delivery => {
      const monitoredStopVisits = delivery.MonitoredStopVisit || [];

      monitoredStopVisits.forEach(visit => {
        const journey = visit.MonitoredVehicleJourney;
        if (!journey) return;

        const lineRef = journey.LineRef || "";
        let lineName = "";

        // Extract line name
        if (lineRef.includes("M7")) lineName = "M7";
        else if (lineRef.includes("M11")) lineName = "M11";
        else return;

        // Only include southbound
        const direction = journey.DirectionRef;
        if (direction && direction !== "SB" && direction !== "Southbound" && !direction.includes("South")) {
          return;
        }

        // Get arrival time from OnwardCalls
        const onwardCalls = journey.OnwardCalls?.OnwardCall;
        if (!onwardCalls || onwardCalls.length === 0) return;

        const nextCall = onwardCalls[0];
        const arrivalTime = nextCall.ExpectedArrivalTime || nextCall.AimedArrivalTime;
        
        if (!arrivalTime) return;

        const arrival = new Date(arrivalTime);
        const mins = Math.round((arrival - now) / 60000);

        if (mins >= 0 && mins <= 60) {
          results.push({
            name: `${lineName} Southbound`,
            mins: mins,
            color: lineName === "M7" ? "green" : "purple",
            type: "bus"
          });
        }
      });
    });
  } catch (e) {
    console.error("Error parsing bus monitoring:", e.message);
  }

  return results;
}
