export async function handler() {
  const routes = ["1", "B", "C", "M7", "M11", "M96"];

  async function fetchRoute(route) {
    try {
      const res = await fetch(
        `https://bustime.mta.info/api/siri/vehicle-monitoring.json?LineRef=${route}`
      );

      const data = await res.json();

      const visits =
        data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]
        ?.VehicleActivity || [];

      const results = visits.map(v => {
        const call =
          v?.MonitoredVehicleJourney?.MonitoredCall;

        const mins = call?.ExpectedArrivalTime
          ? Math.round(
              (new Date(call.ExpectedArrivalTime) - new Date()) / 60000
            )
          : null;

        return {
          line: route,
          mins
        };
      }).filter(x => x.mins !== null);

      return results.slice(0, 3); // 👈 KEY FIX: top 3 per line

    } catch (e) {
      return [];
    }
  }

  const grouped = await Promise.all(routes.map(fetchRoute));

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(grouped.flat())
  };
}
