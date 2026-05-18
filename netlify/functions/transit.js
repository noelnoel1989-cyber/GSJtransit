export async function handler() {
  const stops = [
    { line: "M7/M11", id: "401094" },
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

      const results = visits.map(v => {
        const call = v.MonitoredVehicleJourney?.MonitoredCall;

        const mins = call?.ExpectedArrivalTime
          ? Math.round(
              (new Date(call.ExpectedArrivalTime) - new Date()) / 60000
            )
          : null;

        return {
          line: stop.line,
          mins
        };
      }).filter(x => x.mins !== null);

      // IMPORTANT: force multiple arrivals per line
      return results.slice(0, 3);

    } catch (e) {
      return [];
    }
  }

  const grouped = await Promise.all(stops.map(fetchStop));

  const flat = grouped.flat();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(flat)
  };
}
