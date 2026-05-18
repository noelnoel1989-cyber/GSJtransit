export async function handler() {
  const stops = [
    { line: "1", id: "120S" },   // example placeholder
    { line: "B", id: "631S" },
    { line: "C", id: "631S" },
    { line: "M7", id: "401094" },
    { line: "M11", id: "401094" },
    { line: "M96", id: "401897" }
  ];

  async function fetchStop(stop) {
    try {
      const url =
        `https://bustime.mta.info/api/siri/stop-monitoring.json?MonitoringRef=${stop.id}`;

      const res = await fetch(url);
      const data = await res.json();

      const visits =
        data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]
        ?.MonitoredStopVisit || [];

      return visits.slice(0, 3).map(v => {
        const call = v.MonitoredVehicleJourney;

        const mins = call?.MonitoredCall?.ExpectedArrivalTime
          ? Math.round(
              (new Date(call.MonitoredCall.ExpectedArrivalTime) - new Date()) / 60000
            )
          : null;

        return {
          line: stop.line,
          mins
        };
      }).filter(x => x.mins !== null);

    } catch (e) {
      return [];
    }
  }

  const results = (await Promise.all(stops.map(fetchStop))).flat();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(results)
  };
}
