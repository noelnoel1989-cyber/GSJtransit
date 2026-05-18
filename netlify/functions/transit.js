export async function handler(event, context) {
  try {
    const results = [];

    // Fetch subway data from MTA GTFS-realtime
    try {
      const subwayArrivals = await fetchSubwayArrivals();
      results.push(...subwayArrivals);
    } catch (e) {
      console.error("Error fetching subway data:", e.message);
    }

    // Fetch bus data from MTA Bus Time API
    try {
      const busArrivals = await fetchBusArrivals();
      results.push(...busArrivals);
    } catch (e) {
      console.error("Error fetching bus data:", e.message);
    }

    console.log("Returning results:", results.length, "items");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(results)
    };
  } catch (e) {
    console.error("Error:", e.message);
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

async function fetchSubwayArrivals() {
  const results = [];

  try {
    // Fetch 1 line data
    const data1 = await fetchGTFS("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs");
    const arrivals1 = parseSubwayData(data1, ["127N", "127S"], "1");
    results.push(...arrivals1);

    // Fetch A/C/E lines data
    const dataACE = await fetchGTFS("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace");
    const arrivalsA = parseSubwayData(dataACE, ["A42N", "A42S"], "A");
    const arrivalsC = parseSubwayData(dataACE, ["A43N", "A43S"], "C");
    results.push(...arrivalsA, ...arrivalsC);

    // Fetch B/D/F/M lines data
    const dataBDF = await fetchGTFS("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm");
    const arrivalsB = parseSubwayData(dataBDF, ["B43N", "B43S"], "B");
    const arrivalsD = parseSubwayData(dataBDF, ["D43N", "D43S"], "D");
    results.push(...arrivalsB, ...arrivalsD);

  } catch (e) {
    console.error("Error fetching subway data:", e.message);
  }

  return results;
}

async function fetchGTFS(url) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);
  
  // Parse protobuf manually
  return parseProtobufEntities(data);
}

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
  const entity = { tripUpdate: null };
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
  const tripUpdate = { stopTimeUpdate: [] };
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
  const stopUpdate = { stopId: null, arrival: null, departure: null };
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
  const eventTime = { time: null };
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

function parseSubwayData(feed, targetStopIds, lineName) {
  const results = [];

  if (!feed || !Array.isArray(feed)) {
    return results;
  }

  const now = new Date();

  feed.forEach(entity => {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) return;

    const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];

    stopTimeUpdates.forEach(stopUpdate => {
      const stopId = stopUpdate.stopId;

      if (!targetStopIds.includes(stopId)) {
        return;
      }

      let arrivalTime = null;
      
      if (stopUpdate.arrival && stopUpdate.arrival.time) {
        arrivalTime = new Date(stopUpdate.arrival.time * 1000);
      } else if (stopUpdate.departure && stopUpdate.departure.time) {
        arrivalTime = new Date(stopUpdate.departure.time * 1000);
      }

      if (!arrivalTime) return;

      const mins = Math.round((arrivalTime - now) / 60000);

      if (mins >= 0 && mins <= 120) {
        const direction = stopId.includes("N") ? "Uptown" : "Downtown";

        results.push({
          name: lineName + " " + direction,
          mins: mins,
          color: getSubwayColor(lineName),
          type: "subway"
        });
      }
    });
  });

  return results;
}

function getSubwayColor(lineName) {
  if (lineName === "1") return "red";
  if (lineName === "A" || lineName === "C") return "blue";
  if (lineName === "B" || lineName === "D") return "orange";
  return "red";
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

async function fetchBusArrivals() {
  const results = [];
  const apiKey = "7fddba21-a132-455a-a0e8-52317c61421a";
  
  try {
    const stopIds = ["400969", "400970"];
    
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

        if (lineRef.includes("M7")) lineName = "M7";
        else if (lineRef.includes("M11")) lineName = "M11";
        else return;

        const direction = journey.DirectionRef;
        if (direction && direction !== "SB" && direction !== "Southbound" && !direction.includes("South")) {
          return;
        }

        const onwardCalls = journey.OnwardCalls?.OnwardCall;
        if (!onwardCalls || onwardCalls.length === 0) return;

        const nextCall = onwardCalls[0];
        const arrivalTime = nextCall.ExpectedArrivalTime || nextCall.AimedArrivalTime;
        
        if (!arrivalTime) return;

        const arrival = new Date(arrivalTime);
        const mins = Math.round((arrival - now) / 60000);

        if (mins >= 0 && mins <= 60) {
          results.push({
            name: lineName + " Southbound",
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
