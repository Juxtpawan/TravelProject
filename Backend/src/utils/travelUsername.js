const TRAVEL_ADJECTIVES = [
  'Nomad',
  'Alpine',
  'Wander',
  'Cosmic',
  'Voyager',
  'Global',
  'Roaming',
  'Trekker',
  'Summit',
  'Coastal',
  'Trailblazer',
  'Wayfarer',
  'Odyssey',
  'Horizon',
  'Pathfinder',
  'Backpacker',
  'Expedition',
  'Starlight',
  'Aurora',
  'Safari',
  'Breeze',
  'Terra',
  'Vagabond',
  'Atlas',
  'Meridian',
  'Zephyr',
  'Wilder',
  'Sahara',
  'Everest',
  'Pacific',
  'Nordic',
  'Compass',
  'Mystic',
  'Highland',
  'Solstice',
  'Oceanic',
  'Frontier',
];

const TRAVEL_NOUNS = [
  'Traveler',
  'Explorer',
  'Voyager',
  'Nomad',
  'Trekker',
  'Wanderer',
  'Drifter',
  'Adventurer',
  'Navigator',
  'Roamer',
  'Scout',
  'Hiker',
  'Journeyman',
  'Climber',
  'Seeker',
  'Pioneer',
  'Ranger',
  'Glider',
  'Strider',
];

export function generateRandomTravelUsername() {
  const adj = TRAVEL_ADJECTIVES[Math.floor(Math.random() * TRAVEL_ADJECTIVES.length)];
  const noun = TRAVEL_NOUNS[Math.floor(Math.random() * TRAVEL_NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 990); // 10 to 999
  return `${adj}${noun}${num}`;
}

export async function generateUniqueTravelUsername(d1Query) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const candidate = generateRandomTravelUsername();
    const rows = await d1Query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [candidate]
    );
    if (!rows || rows.length === 0) {
      return candidate;
    }
  }
  // Fallback with timestamp suffix if repeated collisions
  return `Traveler_${Date.now().toString().slice(-6)}`;
}
