// Netlify Function: Fetch NYC Subway Transit Data from MTA GTFS-realtime
// DEBUG VERSION - with detailed logging

export async function handler(event, context) {
  console.log("=== Transit Function Started ===");
  
  try {
    const results = [];

    // Fetch 1 line data
    console.log("Fetching 1 line data...");
    try {
      const arrivals1 = await fetchTrainArrivals(
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
        ["127N", "127S"],
        "1"
      );
      console.log(`1 line arrivals: ${arrivals1.length} trains`);
      results.push(...arrivals1);
    } catch (e) {
      console.error("Error fetching 1 line:", e.message, e.stack);
    }

    // Fetch B/C lines data (A/C/E feed)
    console.log("Fetching B/C lines data...");
    try {
      const arrivalsBC = await fetchTrainArrivals(
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
        ["A43N", "A43S"],
        "B/C"
      );
      console.log(`B/C lines arrivals: ${arrivalsBC.length} trains`);
      results.push(...arrivalsBC);
    } catch (e) {
      console.error("Error fetching B/C lines:", e.message, e.stack);
    }

    // Sort by arrival time
    results.sort((a, b) => a.mins - b.mins);

    console.log(`=== Total results: ${results.length} ===`);
    console.log("Results:", JSON.stringify(results));

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
    console.log(`Fetching from: ${feedUrl}`);
    const response = await fetch(feedUrl);
    
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    console.log(`Received ${buffer.byteLength} bytes`);
    
    const data = new Uint8Array(buffer);

    // Parse protobuf manually
    const entities = parseProtobufEntities(data);
    console.log(`Parsed ${entities.length} entities`);

    const now = new Date();

    entities.forEach((entity, entityIdx) => {
      const tripUpdate = entity.tripUpdate;
      if (!tripUpdate) {
        console.log(`Entity ${entityIdx}: no tripUpdate`);
        return;
      }

      const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];
      console.log(`Entity ${entityIdx}: ${stopTimeUpdates.length} stop time updates`);

      stopTimeUpdates.forEach((stopUpdate, stopIdx) => {
        const stopId = stopUpdate.stopId;

        if (!targetStopIds.includes(stopId)) {
          return;
        }

        console.log(`Found target stop: ${stopId}`);

        // Get arrival time
        let arrivalTime = null;
        
        if (stopUpdate.arrival && stopUpdate.arrival.time) {
          arrivalTime = new Date(stopUpdate.arrival.time * 1000);
        } else if (stopUpdate.departure && stopUpdate.departure.time) {
          arrivalTime = new Date(stopUpdate.departure.time * 1000);
        }

        if (!arrivalTime) {
          console.log(`Stop ${stopId}: no arrival/departure time`);
          return;
        }

        // Calculate minutes until arrival
        const mins = Math.round((arrivalTime - now) / 60000);
        console.log(`Stop ${stopId}: ${mins} minutes`);

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
    console.error(`Error fetching train arrivals for ${lineName}:`, e.message, e.stack);
  }

  return results;
}

// Simple protobuf parser for GTFS-realtime FeedMessage
function parseProtobufEntities(data) {
  const entities = [];
  let pos = 0;

  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;

    pos++;

    if (fieldNumber === 1) { // entities field
      if (wireType === 2) { // length-delimited
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const entityStart = pos;
        const entityEnd = pos + actualLength;
        const entity = parseEntity(data.slice(entityStart, entityEnd));
        
        if (entity) {
          entities.push(entity);
        }

        pos = entityEnd;
      }
    } else if (wireType === 0) { // varint
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) { // length-delimited
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) { // 32-bit
      pos += 4;
    } else {
      pos++;
    }
  }

  return entities;
}

function parseEntity(data) {
  const entity = {
    tripUpdate: null
  };

  let pos = 0;

  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;

    pos++;

    if (fieldNumber === 3) { // tripUpdate field
      if (wireType === 2) { // length-delimited
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const tripStart = pos;
        const tripEnd = pos + actualLength;
        entity.tripUpdate = parseTripUpdate(data.slice(tripStart, tripEnd));
        pos = tripEnd;
      }
    } else if (wireType === 0) { // varint
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) { // length-delimited
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) { // 32-bit
      pos += 4;
    }
  }

  return entity;
}

function parseTripUpdate(data) {
  const tripUpdate = {
    stopTimeUpdate: []
  };

  let pos = 0;

  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;

    pos++;

    if (fieldNumber === 3) { // stopTimeUpdate field
      if (wireType === 2) { // length-delimited
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const stopStart = pos;
        const stopEnd = pos + actualLength;
        const stopUpdate = parseStopTimeUpdate(data.slice(stopStart, stopEnd));
        
        if (stopUpdate) {
          tripUpdate.stopTimeUpdate.push(stopUpdate);
        }

        pos = stopEnd;
      }
    } else if (wireType === 0) { // varint
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) { // length-delimited
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) { // 32-bit
      pos += 4;
    }
  }

  return tripUpdate;
}

function parseStopTimeUpdate(data) {
  const stopUpdate = {
    stopId: null,
    arrival: null,
    departure: null
  };

  let pos = 0;

  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;

    pos++;

    if (fieldNumber === 1) { // stopSequence field
      if (wireType === 0) { // varint
        readVarint(data, pos);
        pos += 1;
        while (pos < data.length && (data[pos] & 0x80)) pos++;
        pos++;
      }
    } else if (fieldNumber === 2) { // arrival field
      if (wireType === 2) { // length-delimited
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const arrStart = pos;
        const arrEnd = pos + actualLength;
        stopUpdate.arrival = parseStopEventTime(data.slice(arrStart, arrEnd));
        pos = arrEnd;
      }
    } else if (fieldNumber === 3) { // departure field
      if (wireType === 2) { // length-delimited
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const depStart = pos;
        const depEnd = pos + actualLength;
        stopUpdate.departure = parseStopEventTime(data.slice(depStart, depEnd));
        pos = depEnd;
      }
    } else if (fieldNumber === 4) { // stopId field
      if (wireType === 2) { // length-delimited (string)
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const idStart = pos;
        const idEnd = pos + actualLength;
        stopUpdate.stopId = new TextDecoder().decode(data.slice(idStart, idEnd));
        pos = idEnd;
      }
    } else if (wireType === 0) { // varint
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) { // length-delimited
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) { // 32-bit
      pos += 4;
    }
  }

  return stopUpdate;
}

function parseStopEventTime(data) {
  const eventTime = {
    time: null
  };

  let pos = 0;

  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;

    pos++;

    if (fieldNumber === 1) { // time field (varint)
      if (wireType === 0) {
        const time = readVarint(data, pos);
        const [value, bytesRead] = time;
        eventTime.time = value;
        pos += bytesRead;
      }
    } else if (wireType === 0) { // varint
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) { // length-delimited
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    }
  }

  return eventTime;
}

function readVarint(data, pos) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (pos + bytesRead < data.length) {
    const byte = data[pos + bytesRead];
    bytesRead++;

    result |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      break;
    }

    shift += 7;
  }

  return [result, bytesRead];
}
