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
