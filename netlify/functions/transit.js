export async function handler(event, context) {
  try {
    const results = [];
    
    console.log("=== Starting transit function ===");

    // Fetch subway data from MTA GTFS-realtime
    try {
      console.log("Fetching subway data...");
      const subwayArrivals = await fetchSubwayArrivals();
      console.log("Subway arrivals:", subwayArrivals.length);
      results.push(...subwayArrivals);
    } catch (e) {
      console.error("Error fetching subway data:", e.message, e.stack);
    }

    // Fetch bus data from MTA Bus Time API
    try {
      console.log("Fetching bus data...");
      const busArrivals = await fetchBusArrivals();
      console.log("Bus arrivals:", busArrivals.length);
      results.push(...busArrivals);
    } catch (e) {
      console.error("Error fetching bus data:", e.message, e.stack);
    }

    console.log("=== Final results: " + results.length + " items ===");

    // Return test data if no real data
    if (results.length === 0) {
      console.log("No data found, returning test data");
      const testData = [
        { name: "1 Uptown", mins: 3, color: "red", type: "subway" },
        { name: "1 Downtown", mins: 7, color: "red", type: "subway" },
        { name: "A Uptown", mins: 4, color: "blue", type: "subway" },
        { name: "A Downtown", mins: 9, color: "blue", type: "subway" },
        { name: "B Uptown", mins: 5, color: "orange", type: "subway" },
        { name: "B Downtown", mins: 12, color: "orange", type: "subway" },
        { name: "C Uptown", mins: 8, color: "blue", type: "subway" },
        { name: "C Downtown", mins: 11, color: "blue", type: "subway" },
        { name: "D Uptown", mins: 6, color: "orange", type: "subway" },
        { name: "D Downtown", mins: 14, color: "orange", type: "subway" },
        { name: "M7 Southbound", mins: 4, color: "green", type: "bus" },
        { name: "M7 Southbound", mins: 10, color: "green", type: "bus" },
        { name: "M11 Southbound", mins: 6, color: "purple", type: "bus" },
        { name: "M11 Southbound", mins: 13, color: "purple", type: "bus" }
      ];
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testData)
      };
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

async function fetchSubwayArrivals() {
  const results = [];

  try {
    console.log("Fetching 1 line...");
    const data1 = await fetchGTFS("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs");
    console.log("1 line data received, parsing...");
    const arrivals1 = parseSubwayData(data1, ["127N", "127S"], "1");
    console.log("1 line arrivals found:", arrivals1.length);
    results.push(...arrivals1);

    console.log("Fetching A/C/E lines...");
    const dataACE = await fetchGTFS("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace");
    console.log("ACE line data received, parsing...");
    const arrivalsA = parseSubwayData(dataACE, ["A42N", "A42S"], "A");
    const arrivalsC = parseSubwayData(dataACE, ["A43N", "A43S"], "C");
    console.log("A arrivals:", arrivalsA.length, "C arrivals:", arrivalsC.length);
    results.push(...arrivalsA, ...arrivalsC);

    console.log("Fetching B/D/F/M lines...");
    const dataBDF = await fetchGTFS("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm");
    console.log("BDF line data received, parsing...");
    const arrivalsB = parseSubwayData(dataBDF, ["B43N", "B43S"], "B");
    const arrivalsD = parseSubwayData(dataBDF, ["D43N", "D43S"], "D");
    console.log("B arrivals:", arrivalsB.length, "D arrivals:", arrivalsD.length);
    results.push(...arrivalsB, ...arrivalsD);

  } catch (e) {
    console.error("Error fetching subway data:", e.message);
  }

  return results;
}

async function fetchGTFS(url) {
  console.log("Fetching GTFS from:", url);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  console.log("Received", buffer.byteLength, "bytes");
  const data = new Uint8Array(buffer);
  
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

    if (fieldNumber === 1) {
      if (wireType === 2) {
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
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      pos++;
    }
  }

  console.log("Parsed", entities.length, "entities");
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

    if (fieldNumber === 3) {
      if (wireType === 2) {
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const tripStart = pos;
        const tripEnd = pos + actualLength;
        entity.tripUpdate = parseTripUpdate(data.slice(tripStart, tripEnd));
        pos = tripEnd;
      }
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) {
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

    if (fieldNumber === 3) {
      if (wireType === 2) {
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
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) {
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

    if (fieldNumber === 1) {
      if (wireType === 0) {
        readVarint(data, pos);
        pos += 1;
        while (pos < data.length && (data[pos] & 0x80)) pos++;
        pos++;
      }
    } else if (fieldNumber === 2) {
      if (wireType === 2) {
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const arrStart = pos;
        const arrEnd = pos + actualLength;
        stopUpdate.arrival = parseStopEventTime(data.slice(arrStart, arrEnd));
        pos = arrEnd;
      }
    } else if (fieldNumber === 3) {
      if (wireType === 2) {
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const depStart = pos;
        const depEnd = pos + actualLength;
        stopUpdate.departure = parseStopEventTime(data.slice(depStart, depEnd));
        pos = depEnd;
      }
    } else if (fieldNumber === 4) {
      if (wireType === 2) {
        const length = readVarint(data, pos);
        const [actualLength, bytesRead] = length;
        pos += bytesRead;

        const idStart = pos;
        const idEnd = pos + actualLength;
        stopUpdate.stopId = new TextDecoder().decode(data.slice(idStart, idEnd));
        pos = idEnd;
      }
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const length = readVarint(data, pos);
      const [actualLength, bytesRead] = length;
      pos += bytesRead + actualLength;
    } else if (wireType === 5) {
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

    if (fieldNumber === 1) {
      if (wireType === 0) {
        const time = readVarint(data, pos);
        const [value, bytesRead] = time;
        eventTime.time = value;
        pos += bytesRead;
      }
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
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
    console.log("No feed data for", lineName);
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
    console.log("Fetching bus data...");
    const stopIds = ["400969", "400970"];
    
    for (const stopId of stopIds) {
      const url = `http://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=${apiKey}&MonitoringRef=${stopId}&LineRef=MTA%20NYCT_M7,MTA%20NYCT_M11`;
      
      console.log("Fetching from:", url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Bus API error for stop ${stopId}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log("Bus data received");
      const busArrivals = parseBusMonitoring(data);
      console.log("Bus arrivals parsed:", busArrivals.length);
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
      console.log("No Siri data");
      return results;
    }

    const deliveries = data.Siri.ServiceDelivery.StopMonitoringDelivery;
    
    if (!deliveries || deliveries.length === 0) {
      console.log("No deliveries");
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
