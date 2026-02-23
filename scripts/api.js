// Simple HTTP helpers

/**
 * GET request.
 * @param {string} endpoint - Relative or absolute URL
 * @param {Object} params
 */
export async function get(endpoint, params = {}) {
  try {
    // Support relative and absolute URLs
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? new URL(endpoint)
      : new URL(endpoint, window.location.origin);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API GET request error:', error);
    throw error;
  }
}

/**
 * POST request.
 * @param {string} endpoint
 * @param {Object} data
 */
export async function post(endpoint, data = {}) {
  try {
    // Support relative and absolute URLs
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? new URL(endpoint)
      : new URL(endpoint, window.location.origin);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API POST request error:', error);
    throw error;
  }
}

/**
 * PUT request.
 * @param {string} endpoint
 * @param {Object} data
 */
export async function put(endpoint, data = {}) {
  try {
    // Support relative and absolute URLs
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? new URL(endpoint)
      : new URL(endpoint, window.location.origin);

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API PUT request error:', error);
    throw error;
  }
}

/**
 * DELETE request.
 * @param {string} endpoint
 */
export async function del(endpoint) {
  try {
    // Support relative and absolute URLs
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? new URL(endpoint)
      : new URL(endpoint, window.location.origin);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API DELETE request error:', error);
    throw error;
  }
}

/**
 * Get Open-Meteo forecast.
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|Array} hourly
 * @param {Object} additionalParams
 */
export async function getOpenMeteoForecast(latitude, longitude, hourly = 'temperature_2m', additionalParams = {}) {
  try {
    const baseUrl = 'https://api.open-meteo.com/v1/forecast';
    const url = new URL(baseUrl);
    
    // Add required parameters
    url.searchParams.append('latitude', latitude);
    url.searchParams.append('longitude', longitude);
    
    // Handle hourly parameter (can be string or array)
    if (Array.isArray(hourly)) {
      url.searchParams.append('hourly', hourly.join(','));
    } else {
      url.searchParams.append('hourly', hourly);
    }
    
    // Add any additional parameters
    Object.keys(additionalParams).forEach(key => {
      if (additionalParams[key] !== null && additionalParams[key] !== undefined) {
        url.searchParams.append(key, additionalParams[key]);
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Open-Meteo API request error:', error);
    throw error;
  }
}

/**
 * Convenience wrapper for temperature + rainfall series.
 */
export async function getOpenMeteoTemperatureAndRainfall(latitude, longitude, additionalParams = {}) {
  const data = await getOpenMeteoForecast(
    latitude,
    longitude,
    ["temperature_2m", "precipitation"],
    additionalParams
  );

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    elevation: data.elevation,
    time: data.hourly?.time ?? [],
    temperature_2m: data.hourly?.temperature_2m ?? [],
    precipitation: data.hourly?.precipitation ?? [],
    raw: data
  };
}
