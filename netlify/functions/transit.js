export async function handler(event, context) {
  try {
    const results = [];

    // Fetch real subway data
    try {
      const subwayData = await fetchSubwayData();
      results.push(...subwayData);
    } catch (e) {
      console.error("Error fetching subway data:", e.message);
    }

    // Fetch real bus data
    try {
      const busData = await fetchBusData();
      results.push(...busData);
    } catch (e) {
      console.error("Error fetching bus data:", e.message);
    }

    // Fallback to test data if nothing loaded
    if (results.length === 0) {
      console.log("No real data, using test data");
      results.push(
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
        { name: "M11 Southbound", mins: 6, color: "purple", type: "bus" }
      );
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

async function fetchSubwayData() {
  const results = [];
  
  try {
    // Fetch 1 line (127N/127S at 86th St)
    const data1 = await fetchGTFSFeed("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs");
    const arrivals1 = parseGTFSFeed(data1, ["127N", "127S"], "1", "red");
    results.push(...arrivals1);
    
    // Fetch A/C/E lines (A42N/A42S for A, A43N/A43S for C)
    const dataACE = await fetchGTFSFeed("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace");
    const arrivalsA = parseGTFSFeed(dataACE, ["A42N", "A42S"], "A", "blue");
    const arrivalsC = parseGTFSFeed(dataACE, ["A43N", "A43S"], "C", "blue");
    results.push(...arrivalsA);
    results.push(...arrivalsC);
    
    // Fetch B/D/F/M lines (B43N/B43S for B, D43N/D43S for D)
    const dataBDF = await fetchGTFSFeed("https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm");
    const arrivalsB = parseGTFSFeed(dataBDF, ["B43N", "B43S"], "B", "orange");
    const arrivalsD = parseGTFSFeed(dataBDF, ["D43N", "D43S"], "D", "orange");
    results.push(...arrivalsB);
    results.push(...arrivalsD);
    
    console.log("Total subway arrivals:", results.length);
  } catch (e) {
    console.error("Subway fetch error:", e.message);
  }
  
  return results;
}

async function fetchGTFSFeed(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return await response.arrayBuffer();
}

function parseGTFSFeed(buffer, stopIds, lineName, color) {
  const results = [];
  const data = new Uint8Array(buffer);
  const now = Math.floor(Date.now() / 1000);
  
  try {
    let pos = 0;
    while (pos < data.length) {
      const byte = data[pos];
      const fieldNumber = byte >> 3;
      const wireType = byte & 0x07;
      pos++;
      
      if (fieldNumber === 1 && wireType === 2) {
        const len = readVarint(data, pos);
        pos += len.bytesRead;
        const entityData = data.slice(pos, pos + len.value);
        pos += len.value;
        
        const entity = parseEntity(entityData);
        if (entity && entity.tripUpdates) {
          for (let i = 0; i < entity.tripUpdates.length; i++) {
            const trip = entity.tripUpdates[i];
            if (trip.stopUpdates) {
              for (let j = 0; j < trip.stopUpdates.length; j++) {
                const stopUpdate = trip.stopUpdates[j];
                if (stopIds.indexOf(stopUpdate.stopId) !== -1) {
                  const arrivalTime = stopUpdate.arrivalTime || stopUpdate.departureTime;
                  if (arrivalTime) {
                    const mins = Math.round((arrivalTime - now) / 60);
                    if (mins >= 0 && mins <= 120) {
                      const direction = stopUpdate.stopId.indexOf("N") !== -1 ? "Uptown" : "Downtown";
                      results.push({
                        name: lineName + " " + direction,
                        mins: mins,
                        color: color,
                        type: "subway"
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } else if (wireType === 0) {
        readVarint(data, pos);
        pos += 1;
        while (pos < data.length && (data[pos] & 0x80)) pos++;
        pos++;
      } else if (wireType === 2) {
        const len = readVarint(data, pos);
        pos += len.bytesRead + len.value;
      } else if (wireType === 5) {
        pos += 4;
      } else {
        pos++;
      }
    }
  } catch (e) {
    console.error("Parse error:", e.message);
  }
  
  return results;
}

function parseEntity(data) {
  const entity = { tripUpdates: [] };
  let pos = 0;
  
  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;
    pos++;
    
    if (fieldNumber === 3 && wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead;
      const tripData = data.slice(pos, pos + len.value);
      pos += len.value;
      
      const trip = parseTripUpdate(tripData);
      entity.tripUpdates.push(trip);
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead + len.value;
    } else if (wireType === 5) {
      pos += 4;
    }
  }
  
  return entity;
}

function parseTripUpdate(data) {
  const trip = { stopUpdates: [] };
  let pos = 0;
  
  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;
    pos++;
    
    if (fieldNumber === 3 && wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead;
      const stopData = data.slice(pos, pos + len.value);
      pos += len.value;
      
      const stop = parseStopUpdate(stopData);
      if (stop) trip.stopUpdates.push(stop);
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead + len.value;
    } else if (wireType === 5) {
      pos += 4;
    }
  }
  
  return trip;
}

function parseStopUpdate(data) {
  const stop = { stopId: null, arrivalTime: null, departureTime: null };
  let pos = 0;
  
  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;
    pos++;
    
    if (fieldNumber === 4 && wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead;
      stop.stopId = String.fromCharCode.apply(null, data.slice(pos, pos + len.value));
      pos += len.value;
    } else if (fieldNumber === 2 && wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead;
      const timeData = data.slice(pos, pos + len.value);
      pos += len.value;
      stop.arrivalTime = parseStopEventTime(timeData);
    } else if (fieldNumber === 3 && wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead;
      const timeData = data.slice(pos, pos + len.value);
      pos += len.value;
      stop.departureTime = parseStopEventTime(timeData);
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead + len.value;
    }
  }
  
  return stop.stopId ? stop : null;
}

function parseStopEventTime(data) {
  let pos = 0;
  while (pos < data.length) {
    const byte = data[pos];
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;
    pos++;
    
    if (fieldNumber === 1 && wireType === 0) {
      const time = readVarint(data, pos);
      return time.value;
    } else if (wireType === 0) {
      readVarint(data, pos);
      pos += 1;
      while (pos < data.length && (data[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 2) {
      const len = readVarint(data, pos);
      pos += len.bytesRead + len.value;
    }
  }
  return null;
}

function readVarint(data, pos) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  
  while (pos + bytesRead < data.length) {
    const byte = data[pos + bytesRead];
    bytesRead++;
    result |= (byte & 0x7f) << shift;
    
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  
  return { value: result, bytesRead: bytesRead };
}

async function fetchBusData() {
  const results = [];
  const apiKey = "7fddba21-a132-455a-a0e8-52317c61421a";
  
  try {
    const stopIds = ["400969", "400970"];
    const now = new Date();
    
    for (let i = 0; i < stopIds.length; i++) {
      try {
        const stopId = stopIds[i];
        const url = "https://api.prod.obanyc.com/api/siri/stop-monitoring.json?key=" + apiKey + "&MonitoringRef=" + stopId;
        
        const response = await fetch(url);
        if (!response.ok) continue;
        
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
              if (lineRef.indexOf("M7") !== -1) lineName = "M7";
              else if (lineRef.indexOf("M11") !== -1) lineName = "M11";
              else continue;
              
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
        console.error("Bus stop error:", e.message);
      }
    }
  } catch (e) {
    console.error("Bus fetch error:", e.message);
  }
  
  return results;
}
