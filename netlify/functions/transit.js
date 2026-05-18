export async function handler() {
  const stops = [
    { name: "M7/M11 @ 84th St", id: "401094" },
    { name: "M96 EB @ 96th St", id: "401897" }
  ];

  async function get(stop) {
    try {
      const res = await fetch(
        `https://bustime.mta.info/api/siri/stop-monitoring.json?MonitoringRef=${stop.id}`
      );

      const data = await res.json();

      const visits =
        data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]
        ?.MonitoredStopVisit || [];

      return visits.map(v => {
        const call = v.MonitoredVehicleJourney;

        const mins = call?.MonitoredCall?.ExpectedArrivalTime
          ? Math.round(
              (new Date(call.MonitoredCall.ExpectedArrivalTime) - new Date()) / 60000
            )
          : null;

        return {
          name: stop.name + " " + (call?.PublishedLineName || ""),
          mins
        };
      }).filter(x => x.mins !== null);

    } catch (e) {
      return [];
    }
  }

  const results = (await Promise.all(stops.map(get))).flat();
  results.sort((a, b) => a.mins - b.mins);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(results)
  };
} 
