const EARTH_RADIUS_METERS = 6_371_000;
const GOOGLE_ROUTE_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

function haversineMeters(left, right) {
  const radians = value => value * Math.PI / 180;
  const latitudeDelta = radians(right.lat - left.lat);
  const longitudeDelta = radians(right.lng - left.lng);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value));
}

function parseDurationSeconds(duration) {
  const match = typeof duration === 'string' && duration.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : null;
}

export async function fetchGoogleRouteMatrix(items, env, travelMode = 'DRIVE') {
  const apiKey = env?.GOOGLE_ROUTES_API_KEY || env?.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey || items.length < 2 || items.length > 20) return null;

  const waypoint = item => ({
    waypoint: {
      location: {
        latLng: { latitude: item.lat, longitude: item.lng },
      },
    },
  });

  try {
    const response = await fetch(GOOGLE_ROUTE_MATRIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
      },
      body: JSON.stringify({
        origins: items.map(waypoint),
        destinations: items.map(waypoint),
        travelMode,
        routingPreference: travelMode === 'DRIVE' ? 'TRAFFIC_UNAWARE' : undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Google Routes returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[AI route optimization] Google Routes unavailable:', error.message);
    return null;
  }
}

export function optimizeStopOrder(items, matrix = null) {
  if (items.length < 2) return { items, source: matrix ? 'google_routes' : 'straight_line', totalDistanceMeters: 0, totalDurationSeconds: 0 };

  const matrixByPair = new Map();
  for (const row of Array.isArray(matrix) ? matrix : []) {
    if (row.condition !== 'ROUTE_EXISTS') continue;
    matrixByPair.set(`${row.originIndex}:${row.destinationIndex}`, {
      distanceMeters: Number(row.distanceMeters) || 0,
      durationSeconds: parseDurationSeconds(row.duration),
    });
  }

  const point = item => ({ lat: Number(item.latitude), lng: Number(item.longitude) });
  const leg = (fromIndex, toIndex) => {
    const route = matrixByPair.get(`${fromIndex}:${toIndex}`);
    if (route?.durationSeconds !== null && route?.durationSeconds !== undefined) {
      return { ...route, exact: Boolean(matrix) };
    }
    return {
      distanceMeters: haversineMeters(point(items[fromIndex]), point(items[toIndex])),
      durationSeconds: null,
      exact: false,
    };
  };

  const remaining = new Set(items.map((_, index) => index).slice(1));
  const indexes = [0];
  const legs = [];
  let current = 0;

  while (remaining.size) {
    let next = null;
    let nextLeg = null;
    for (const candidate of remaining) {
      const candidateLeg = leg(current, candidate);
      const candidateCost = candidateLeg.durationSeconds ?? candidateLeg.distanceMeters;
      const currentCost = nextLeg?.durationSeconds ?? nextLeg?.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (candidateCost < currentCost) {
        next = candidate;
        nextLeg = candidateLeg;
      }
    }
    remaining.delete(next);
    indexes.push(next);
    legs.push(nextLeg);
    current = next;
  }

  const timeSlots = items.map(item => item.start_time).filter(Boolean).sort();
  const orderedItems = indexes.map((itemIndex, orderIndex) => ({
    ...items[itemIndex],
    order_index: orderIndex,
    start_time: timeSlots[orderIndex] || items[itemIndex].start_time,
  }));
  const usesGoogleForEveryLeg = legs.length > 0 && legs.every(route => route.exact);

  return {
    items: orderedItems,
    source: usesGoogleForEveryLeg ? 'google_routes' : 'straight_line',
    totalDistanceMeters: legs.reduce((total, route) => total + route.distanceMeters, 0),
    totalDurationSeconds: usesGoogleForEveryLeg
      ? legs.reduce((total, route) => total + route.durationSeconds, 0)
      : null,
  };
}