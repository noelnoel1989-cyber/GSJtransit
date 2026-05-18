// Netlify Function: Fetch NYC Subway Transit Data from MTA GTFS-realtime
// Uses the official MTA protobuf feeds (no authentication required as of 2024)
// Feeds:
// - 1 line: https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs
// - B/D/F/M: https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm
// - A/C/E: https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace

const GTFS = require('gtfs-realtime-bindings');

// Stop IDs for your requested stations:
// 1 Line at 86th St: 127N (northbound), 127S (southbound)
// B/C Lines at 86th St: A43N (northbound), A43S (southbound)

const STOPS_TO_TRACK = {
  "127N": { line: "1", direction: "↑" },  // 1 northbound
  "127S": { line: "1", direction: "↓" },  // 1 southbound
  "A43N": { line: "B/C", direction: "↑" },  // B/C northbound
  "A43S": { line: "B/C", direction: "↓" }   // B/C southbound
};

export async function handler(event, context) {
  try {
    const results = [];

    // Fetch 1 line data
    try {
      const data1 = await fetchAndParseGTFS(
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
      );
      const arrivals1 = extractArrivals(data1, ["127N", "127S"], "1");
      results.push(...arrivals1);
    } catch (e) {
      console.error("Error fetching 1 line:", e.message);
    }

    // Fetch B/C lines data
    try {
      const dataBC = await fetchAndParseGTFS(
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace"
      );
      const arrivalsBC = extractArrivals(dataBC, ["A43N", "A43S"], "B/C");
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

async function fetchAndParseGTFS(url) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const feed = GTFS.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  );
  
  return feed;
}

function extractArrivals(feed, targetStopIds, lineName) {
  const results = [];

  if (!feed || !feed.entity) {
    return results;
  }

  const now = new Date();

  feed.entity.forEach(entity => {
    if (!entity.tripUpdate) return;

    const tripUpdate = entity.tripUpdate;
    
    // Get trip info
    const trip = tripUpdate.trip;
    if (!trip) return;

    // Get stop time updates
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
        arrivalTime = new Date(stopUpdate.arrival.time * 1000);
      } else if (stopUpdate.departure && stopUpdate.departure.time) {
        arrivalTime = new Date(stopUpdate.departure.time * 1000);
      }

      if (!arrivalTime) return;

      // Calculate minutes until arrival
      const mins = Math.round((arrivalTime - now) / 60000);

      // Only include trains arriving within 2 hours
      if (mins >= 0 && mins <= 120) {
        // Determine direction
        const direction = stopId.includes("N") ? "↑" : "↓";

        results.push({
          name: `${lineName} ${direction}`,
          mins: mins
        });
      }
    });
  });

  return results;
}
