export async function handler() {
  const routes = ["M7", "M11", "M96"];

  async function fetchRoute(route) {
    try {
      const res = await fetch(
        `https://bustime.mta.info/api/siri/vehicle-monitoring.json?key=&LineRef=${route}`
      );

      const data = await res.json();

      const visits =
        data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]
        ?.VehicleActivity || [];

      return visits.slice(0, 3).map(v => {
        const mins =
          v?.MonitoredVehicleJourney?.MonitoredCall?.ExpectedArrivalTime
            ? Math.round(
                (new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime) - new Date()) / 60000
              )
            : null;

        return {
          name: route,
          mins
        };
      }).filter(x => x.mins !== null);

    } catch (e) {
      return [];
    }
  }

  const results = (await Promise.all(routes.map(fetchRoute))).flat();
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
