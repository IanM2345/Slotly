// apps/mobile/lib/api/map.js
import api from '../api/client';

/** Create a lightweight Places session token (safe on web & native) */
export function newPlacesSessionToken() {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}${rand()}${rand()}`;
}

/**
 * Places Autocomplete
 * @param {string} q - user query
 * @param {{ sessiontoken?: string, lat?: number, lng?: number, language?: string, components?: string, types?: string }} [opts]
 * @returns {Promise<Array<{ description: string, place_id: string, structured_formatting?: any, types?: string[] }>>}
 */
export async function placesAutocomplete(q, opts = {}) {
  if (!q || !q.trim()) return [];
  const { sessiontoken, lat, lng, language = "en", components = "country:KE", types } = opts;
  
  try {
    const { data } = await api.get("/api/maps/autocomplete", {
      params: {
        q: q.trim(),
        ...(sessiontoken ? { sessiontoken } : {}),
        ...(lat != null && lng != null ? { lat, lng } : {}),
        ...(language ? { language } : {}),
        ...(components ? { components } : {}),
        ...(types ? { types } : {}), // <-- toggle 'establishment' when needed
      },
      timeout: 8000,
    });
    return data?.predictions || [];
  } catch (error) {
    console.warn("Places autocomplete failed:", error);
    return [];
  }
}

/**
 * Place Details (lat/lng + formatted address)
 * @param {string} placeId
 * @returns {Promise<{ address?: string, name?: string, location?: { lat: number, lng: number }, components?: any[] }>}
 */
export async function placeDetails(placeId) {
  if (!placeId) return {};
  
  try {
    const { data } = await api.get("/api/maps/details", {
      params: { place_id: placeId },
      timeout: 8000,
    });
    return {
      address: data?.address,
      name: data?.name,
      location: data?.location,
      components: data?.components,
    };
  } catch (error) {
    console.warn("Place details failed:", error);
    return {};
  }
}

/**
 * Geocoding - Convert address to coordinates or vice versa
 * @param {{ address?: string, latlng?: string, place_id?: string }} params
 * @returns {Promise<{ address?: string, location?: { lat: number, lng: number }, raw?: any[] }>}
 */
export async function geocode({ address, latlng, place_id }) {
  if (!address && !latlng && !place_id) return {};
  
  try {
    const { data } = await api.get("/api/maps/geocode", {
      params: {
        ...(address ? { address } : {}),
        ...(latlng ? { latlng } : {}),
        ...(place_id ? { place_id } : {}),
      },
      timeout: 8000,
    });
    return {
      address: data?.address,
      location: data?.location,
      raw: data?.raw,
    };
  } catch (error) {
    console.warn("Geocoding failed:", error);
    return {};
  }
}

/**
 * Reverse geocoding helper - Get address from coordinates
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ address?: string, location?: { lat: number, lng: number } }>}
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return {};
  return geocode({ latlng: `${lat},${lng}` });
}

/**
 * Forward geocoding helper - Get coordinates from address
 * @param {string} address
 * @returns {Promise<{ address?: string, location?: { lat: number, lng: number } }>}
 */
export async function forwardGeocode(address) {
  if (!address) return {};
  return geocode({ address });
}

/**
 * Get user's current location with error handling
 * @param {{ enableHighAccuracy?: boolean, timeout?: number, maximumAge?: number }} [options]
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export function getCurrentLocation(options = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      resolve(null);
      return;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
      ...options
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Geolocation error:", error.message);
        resolve(null);
      },
      defaultOptions
    );
  });
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {{ lat: number, lng: number }} point1
 * @param {{ lat: number, lng: number }} point2
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
      Math.cos(toRadians(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Debounced autocomplete for search inputs
 * @param {Function} callback - Function to call with results
 * @param {number} delay - Debounce delay in ms
 * @returns {Function} Debounced search function
 */
export function createDebouncedSearch(callback, delay = 300) {
  let timeoutId;
  let sessionToken = newPlacesSessionToken();
  
  return async (query, opts = {}) => {
    clearTimeout(timeoutId);
    
    if (!query || !query.trim()) {
      callback([]);
      return;
    }

    timeoutId = setTimeout(async () => {
      try {
        const results = await placesAutocomplete(query, {
          sessiontoken: sessionToken,
          ...opts,
        });
        callback(results);
      } catch (error) {
        console.warn("Debounced search failed:", error);
        callback([]);
      }
    }, delay);
  };
}

/**
 * Extract address components by type
 * @param {any[]} components - Address components from place details
 * @param {string} type - Component type to extract
 * @returns {string|null} Component value
 */
export function getAddressComponent(components, type) {
  if (!components || !Array.isArray(components)) return null;
  const component = components.find(c => c.types && c.types.includes(type));
  return component?.long_name || component?.short_name || null;
}

/**
 * Parse address components into structured object
 * @param {any[]} components - Address components from place details
 * @returns {object} Parsed address object
 */
export function parseAddressComponents(components) {
  if (!components) return {};
  
  return {
    streetNumber: getAddressComponent(components, 'street_number'),
    route: getAddressComponent(components, 'route'),
    locality: getAddressComponent(components, 'locality'),
    sublocality: getAddressComponent(components, 'sublocality'),
    administrativeArea1: getAddressComponent(components, 'administrative_area_level_1'),
    administrativeArea2: getAddressComponent(components, 'administrative_area_level_2'),
    country: getAddressComponent(components, 'country'),
    postalCode: getAddressComponent(components, 'postal_code'),
  };
}

// Re-export common utilities
export {
  newPlacesSessionToken as createSessionToken,
  getCurrentLocation as getLocation,
  calculateDistance as getDistance,
};