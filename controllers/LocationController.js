/**
 * LocationController.js
 * Provides worldwide location autocomplete and search for job posting.
 * Uses Photon (OpenStreetMap geocoder) with fallback to Nominatim & curated global cities.
 */

const locationCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

// Curated top metro & global tech hubs for default display
const DEFAULT_TOP_LOCATIONS = [
  { label: "Bangalore / Bengaluru", value: "Bangalore", mainText: "Bangalore / Bengaluru", subText: "Karnataka, India", city: "Bangalore", state: "Karnataka", country: "India", isTop: true },
  { label: "Chennai", value: "Chennai", mainText: "Chennai", subText: "Tamil Nadu, India", city: "Chennai", state: "Tamil Nadu", country: "India", isTop: true },
  { label: "Hyderabad / Secunderabad", value: "Hyderabad", mainText: "Hyderabad / Secunderabad", subText: "Telangana, India", city: "Hyderabad", state: "Telangana", country: "India", isTop: true },
  { label: "Mumbai (All Areas)", value: "Mumbai", mainText: "Mumbai (All Areas)", subText: "Maharashtra, India", city: "Mumbai", state: "Maharashtra", country: "India", isTop: true },
  { label: "Delhi / NCR", value: "Delhi", mainText: "Delhi / NCR", subText: "India", city: "Delhi", state: "Delhi", country: "India", isTop: true },
  { label: "Noida", value: "Noida", mainText: "Noida", subText: "Uttar Pradesh, India", city: "Noida", state: "Uttar Pradesh", country: "India", isTop: true },
  { label: "Gurgaon / Gurugram", value: "Gurgaon", mainText: "Gurgaon / Gurugram", subText: "Haryana, India", city: "Gurgaon", state: "Haryana", country: "India", isTop: true },
  { label: "Pune", value: "Pune", mainText: "Pune", subText: "Maharashtra, India", city: "Pune", state: "Maharashtra", country: "India", isTop: true },
  { label: "Kochi", value: "Kochi", mainText: "Kochi", subText: "Kerala, India", city: "Kochi", state: "Kerala", country: "India", isTop: true },
  { label: "Coimbatore", value: "Coimbatore", mainText: "Coimbatore", subText: "Tamil Nadu, India", city: "Coimbatore", state: "Tamil Nadu", country: "India", isTop: true },
  { label: "Kolkata", value: "Kolkata", mainText: "Kolkata", subText: "West Bengal, India", city: "Kolkata", state: "West Bengal", country: "India", isTop: true },
  { label: "Ahmedabad", value: "Ahmedabad", mainText: "Ahmedabad", subText: "Gujarat, India", city: "Ahmedabad", state: "Gujarat", country: "India", isTop: true },
  { label: "Chandigarh", value: "Chandigarh", mainText: "Chandigarh", subText: "Punjab / Haryana, India", city: "Chandigarh", state: "Chandigarh", country: "India", isTop: true },
  { label: "Trivandrum", value: "Trivandrum", mainText: "Trivandrum", subText: "Kerala, India", city: "Thiruvananthapuram", state: "Kerala", country: "India", isTop: true },
  { label: "Dubai", value: "Dubai", mainText: "Dubai", subText: "United Arab Emirates", city: "Dubai", state: "Dubai", country: "United Arab Emirates", isTop: true },
  { label: "Singapore", value: "Singapore", mainText: "Singapore", subText: "Singapore", city: "Singapore", state: "Singapore", country: "Singapore", isTop: true },
  { label: "London", value: "London", mainText: "London", subText: "England, United Kingdom", city: "London", state: "England", country: "United Kingdom", isTop: true },
  { label: "New York", value: "New York", mainText: "New York", subText: "United States", city: "New York", state: "New York", country: "United States", isTop: true },
  { label: "San Francisco", value: "San Francisco", mainText: "San Francisco", subText: "California, United States", city: "San Francisco", state: "California", country: "United States", isTop: true },
  { label: "Toronto", value: "Toronto", mainText: "Toronto", subText: "Ontario, Canada", city: "Toronto", state: "Ontario", country: "Canada", isTop: true },
  { label: "Sydney", value: "Sydney", mainText: "Sydney", subText: "New South Wales, Australia", city: "Sydney", state: "New South Wales", country: "Australia", isTop: true },
  { label: "Tokyo", value: "Tokyo", mainText: "Tokyo", subText: "Japan", city: "Tokyo", state: "Tokyo", country: "Japan", isTop: true },
  { label: "Berlin", value: "Berlin", mainText: "Berlin", subText: "Germany", city: "Berlin", state: "Berlin", country: "Germany", isTop: true }
];

const noisyTypes = new Set([
  'bus_stop', 'waste_basket', 'bench', 'post_box', 'traffic_signals',
  'crossing', 'tree', 'parking', 'fuel', 'toilet', 'drinking_water',
  'telephone', 'vending_machine', 'atm', 'recycling', 'picnic_table'
]);

function parsePhotonFeatures(features) {
  if (!Array.isArray(features)) return [];

  const parsed = features.map(f => {
    const p = f.properties;
    if (!p || !p.name) return null;
    if (noisyTypes.has(p.osm_value)) return null;

    const name = p.name;
    const city = p.city && p.city.toLowerCase() !== name.toLowerCase() ? p.city : null;
    const state = p.state && p.state.toLowerCase() !== name.toLowerCase() ? p.state : null;
    const country = p.country;

    const mainText = city ? `${name}, ${city}` : name;
    const subParts = [];
    if (city && !mainText.includes(city)) subParts.push(city);
    if (state) subParts.push(state);
    if (country) subParts.push(country);
    const subText = subParts.join(', ');

    const fullParts = [name];
    if (city && !fullParts.includes(city)) fullParts.push(city);
    if (state && !fullParts.includes(state)) fullParts.push(state);
    if (country && !fullParts.includes(country)) fullParts.push(country);
    const fullLabel = fullParts.join(', ');

    const isPlace = p.osm_key === 'place' || p.osm_key === 'boundary' ||
      ['city', 'town', 'village', 'suburb', 'neighbourhood', 'locality', 'district', 'state', 'province', 'country'].includes(p.osm_value);

    return {
      label: fullLabel,
      value: fullLabel,
      mainText,
      subText: subText || country || '',
      city: city || name,
      state: state || '',
      country: country || '',
      type: p.osm_value || 'location',
      isPlace: Boolean(isPlace)
    };
  }).filter(Boolean);

  // Prioritize geographic places (city, town, suburb, country) over roads/amenities
  parsed.sort((a, b) => (b.isPlace ? 1 : 0) - (a.isPlace ? 1 : 0));

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const item of parsed) {
    const key = item.value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.slice(0, 15);
}

async function fetchLocationsInternal(query = '') {
  const q = (query || '').trim();

  // Return default top cities when query is empty or less than 2 chars
  if (!q || q.length < 2) {
    return DEFAULT_TOP_LOCATIONS;
  }

  // Check cache
  const cacheKey = q.toLowerCase();
  const cached = locationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let results = [];

  // 1. Primary: Photon API (Fast, comprehensive OpenStreetMap worldwide data)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=en&limit=25`;
    const response = await fetch(photonUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      results = parsePhotonFeatures(data.features);
    }
  } catch (err) {
    console.warn("Photon search failed or timed out:", err.message);
  }

  // 2. Fallback: OpenStreetMap Nominatim
  if (!results || results.length === 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=10`;
      const response = await fetch(nominatimUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CareerFast-JobPortal/1.0 (contact@careerfast.in)',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          results = data.map(item => {
            const addr = item.address || {};
            const name = item.name || addr.city || addr.town || addr.village || addr.suburb || item.display_name.split(',')[0];
            const city = addr.city || addr.town || addr.county;
            const state = addr.state;
            const country = addr.country;

            const fullParts = [name];
            if (city && city.toLowerCase() !== name.toLowerCase()) fullParts.push(city);
            if (state && state.toLowerCase() !== name.toLowerCase()) fullParts.push(state);
            if (country && country.toLowerCase() !== name.toLowerCase()) fullParts.push(country);
            const fullLabel = fullParts.join(', ');

            return {
              label: fullLabel,
              value: fullLabel,
              mainText: name,
              subText: [state, country].filter(Boolean).join(', '),
              city: city || name,
              state: state || '',
              country: country || '',
              type: item.type || 'place',
              isPlace: true
            };
          });
        }
      }
    } catch (nomErr) {
      console.warn("Nominatim fallback failed:", nomErr.message);
    }
  }

  // 3. Fallback: Filter DEFAULT_TOP_LOCATIONS
  if (!results || results.length === 0) {
    const qLower = q.toLowerCase();
    results = DEFAULT_TOP_LOCATIONS.filter(item =>
      item.label.toLowerCase().includes(qLower) ||
      item.mainText.toLowerCase().includes(qLower)
    );
  }

  // Always allow the user's typed term as a selectable custom option if not already present
  const qLower = q.toLowerCase();
  const hasExact = results.some(r => r.value.toLowerCase() === qLower || r.mainText.toLowerCase() === qLower);
  if (!hasExact && q.length >= 2) {
    const titleCased = q.charAt(0).toUpperCase() + q.slice(1);
    results.unshift({
      label: titleCased,
      value: titleCased,
      mainText: titleCased,
      subText: "Custom Location",
      city: titleCased,
      state: "",
      country: "",
      type: "custom",
      isPlace: true
    });
  }

  // Cache the result
  locationCache.set(cacheKey, {
    timestamp: Date.now(),
    data: results
  });

  // Cleanup cache if it grows too large
  if (locationCache.size > 1000) {
    const oldestKey = locationCache.keys().next().value;
    locationCache.delete(oldestKey);
  }

  return results;
}

const LocationController = {
  DEFAULT_TOP_LOCATIONS,
  fetchLocationsInternal,
  searchLocations: async (req, res) => {
    try {
      const q = (req.query.q || req.query.query || req.query.keyword || '').trim();
      const results = await fetchLocationsInternal(q);
      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error("Error in searchLocations:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to search locations",
        data: DEFAULT_TOP_LOCATIONS
      });
    }
  }
};

module.exports = LocationController;
