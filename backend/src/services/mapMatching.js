const OSRM_HOST = process.env.OSRM_HOST || "https://router.project-osrm.org";

export async function matchToRoad(latitude, longitude) {
  const url = `${OSRM_HOST}/nearest/v1/driving/${longitude},${latitude}?number=1`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.waypoints?.[0]) {
      return null;
    }

    const waypoint = data.waypoints[0];

    return {
      osmWayId: String(waypoint.way_id || waypoint.nodes?.[0] || "unknown"),
      roadName: waypoint.name || "Unknown road",
      matchedLocation: {
        latitude: waypoint.location[1],
        longitude: waypoint.location[0]
      },
      distance: waypoint.distance || 0
    };
  } catch {
    return null;
  }
}

export function extractRoadType(roadName) {
  if (!roadName || roadName === "Unknown road") return "unclassified";

  const lower = roadName.toLowerCase();

  if (lower.includes("highway") || lower.includes("nh ") || lower.startsWith("nh")) return "highway";
  if (lower.includes("expressway") || lower.includes("freeway")) return "highway";
  if (lower.includes("main road") || lower.includes("primary")) return "primary";
  if (lower.includes("secondary")) return "secondary";
  if (lower.includes("tertiary")) return "tertiary";
  if (lower.includes("residential") || lower.includes("colony") || lower.includes("society")) return "residential";
  if (lower.includes("service") || lower.includes("access")) return "service";

  return "unclassified";
}
