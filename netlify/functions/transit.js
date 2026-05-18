// Netlify Function: Fetch NYC Subway Transit Data from MTA GTFS-realtime
// Uses gtfs-rt-bindings (actively maintained alternative)

const { FeedMessage } = require('gtfs-rt-bindings');

export async function handler(event, context) {
  try {
    const results = [];

    // Fetch 1 line data
    try {
      const arrivals1 = await fetchTrainArrivals(
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
        ["127N", "127S"],
        "1"
      );
      results.push(...arrivals1);
    } catch (e) {
      console.error("Error fetching 1 line:", e.message);
    }

    // Fetch B/C lines data (A/C/E feed contains B/C)
    try {
      const arrivalsBC = await fetchTrainArrivals(
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
        ["A43N", "A43S"],
        "B/C"
      );
      results.push(...arrivalsBC);
    } catch (e) {
      console.error("Error fetching B/C lines:", e.message);
    }

    // Sort by arrival time
    results.sort((a, b) => a.mins - b.mins);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(results)
    };

  } catch (e) {
    console.error("Handler error:", e);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify([])
    };
  }
}

async function fetchTrainArrivals(feedUrl, targetStopIds, lineName) {
  const results = [];

  try {
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = FeedMessage.decode(new Uint8Array(buffer));

    if (!feed.entity) {
      return results;
    }

    const now = new Date();

    feed.entity.forEach(entity => {
      if (!entity.tripUpdate) return;

      const tripUpdate = entity.tripUpdate;
      const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];

      stopTimeUpdates.forEach(stopUpdate => {
        const stopId = stopUpdate.stopId;

        // Check if this is one of our target stops
        if (!targetStopIds.includes(stopId)) {
          return;
        }

        // Get arrival time
        let arrivalTime = null;
        
        if (stopUpdate.arrival && stopUpdate.arrival.time) {
          arrivalTime = new Date(parseInt(stopUpdate.arrival.time) * 1000);
        } else if (stopUpdate.departure && stopUpdate.departure.time) {
          arrivalTime = new Date(parseInt(stopUpdate.departure.time) * 1000);
        }

        if (!arrivalTime) return;

        // Calculate minutes until arrival
        const mins = Math.round((arrivalTime - now) / 60000);

        // Only include trains arriving within 2 hours
        if (mins >= 0 && mins <= 120) {
          // Determine direction from stop ID
          const direction = stopId.includes("N") ? "↑" : "↓";

          results.push({
            name: `${lineName} ${direction}`,
            mins: mins
          });
        }
      });
    });

  } catch (e) {
    console.error("Error fetching train arrivals:", e.message);
  }

  return results;
}
