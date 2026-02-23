// Weather display helpers

import { getOpenMeteoTemperatureAndRainfall } from './api.js';

/**
 * Show weather data for a coordinate.
 * @param {Object} map - Leaflet map
 * @param {number} latitude
 * @param {number} longitude
 */
async function displayWeatherAtLocation(map, latitude, longitude) {
  try {
    // Show loading indicator
    const loadingPopup = L.popup()
      .setLatLng([latitude, longitude])
      .setContent('Loading weather data...')
      .openOn(map);

    // Fetch weather data
    const weather = await getOpenMeteoTemperatureAndRainfall(latitude, longitude);

    // Extract data into variables
    const temperatures = weather.temperature_2m;
    const rainfall = weather.precipitation;
    const timestamps = weather.time;
    const timezone = weather.timezone;
    const elevation = weather.elevation;

    // Summary stats
    const averageTemp = temperatures.length > 0
      ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
      : 0;
    const totalRainfall = rainfall.length > 0
      ? rainfall.reduce((a, b) => a + b, 0)
      : 0;
    const maxRainfall = rainfall.length > 0
      ? Math.max(...rainfall)
      : 0;

    // Display content
    const content = `
Weather Data

Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
Elevation: ${elevation}m
Timezone: ${timezone}

Average Temperature: ${averageTemp.toFixed(1)}°C
Total Rainfall: ${totalRainfall.toFixed(1)}mm
Max Hourly Rainfall: ${maxRainfall.toFixed(1)}mm
Data points: ${temperatures.length} hours
    `;

    // Close loading popup and show weather data
    map.closePopup();
    L.popup()
      .setLatLng([latitude, longitude])
      .setContent(content)
      .openOn(map);

  } catch (error) {
    console.error('Error fetching weather data:', error);
    
    // Show error popup
    map.closePopup();
    L.popup()
      .setLatLng([latitude, longitude])
      .setContent(`Error\n\nFailed to fetch weather data.\n${error.message}`)
      .openOn(map);
  }
}

/**
 * Initialize weather click functionality on the map
 * This function sets up the click handler to display weather data
 * @param {Object} map - Leaflet map instance
 */
export function initWeatherClickHandler(map, comparisonCheckFn = null) {
  // Add click event listener to the map
  map.on('click', function(e) {
    // Skip if comparison mode is active (if check function provided)
    if (comparisonCheckFn && comparisonCheckFn()) {
      return;
    }
    
    // Leaflet provides lat/lng in the click event
    const latitude = e.latlng.lat;
    const longitude = e.latlng.lng;
    
    // Display weather data at the clicked location
    displayWeatherAtLocation(map, latitude, longitude);
  });

  console.log('Weather click handler initialized - click anywhere on the map to see weather data');
}

