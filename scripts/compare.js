// Compare weather and risk between two locations

import { getOpenMeteoTemperatureAndRainfall } from './api.js';

let firstLocation = null;
let secondLocation = null;
let comparisonMode = false;

/**
 * Compare two locations.
 * @param {Object} map
 * @param {Object} loc1 - { lat, lng, name?, riskLevel? }
 * @param {Object} loc2 - { lat, lng, name?, riskLevel? }
 */
async function compareLocations(map, loc1, loc2) {
  try {
    const lat1 = loc1.lat;
    const lng1 = loc1.lng;
    const lat2 = loc2.lat;
    const lng2 = loc2.lng;

    // Loading indicator
    const loadingPopup = L.popup()
      .setLatLng([(lat1 + lat2) / 2, (lng1 + lng2) / 2])
      .setContent('Loading comparison data...')
      .openOn(map);

    // Fetch weather for both locations
    const [weather1, weather2] = await Promise.all([
      getOpenMeteoTemperatureAndRainfall(lat1, lng1),
      getOpenMeteoTemperatureAndRainfall(lat2, lng2)
    ]);

    // Location 1
    const temps1 = weather1.temperature_2m;
    const rain1 = weather1.precipitation;
    const timezone1 = weather1.timezone;
    const elevation1 = weather1.elevation;

    // Location 2
    const temps2 = weather2.temperature_2m;
    const rain2 = weather2.precipitation;
    const timezone2 = weather2.timezone;
    const elevation2 = weather2.elevation;

    // Stats for location 1
    const avgTemp1 = temps1.length > 0
      ? temps1.reduce((a, b) => a + b, 0) / temps1.length
      : 0;
    const totalRain1 = rain1.length > 0
      ? rain1.reduce((a, b) => a + b, 0)
      : 0;
    const maxRain1 = rain1.length > 0
      ? Math.max(...rain1)
      : 0;

    // Stats for location 2
    const avgTemp2 = temps2.length > 0
      ? temps2.reduce((a, b) => a + b, 0) / temps2.length
      : 0;
    const totalRain2 = rain2.length > 0
      ? rain2.reduce((a, b) => a + b, 0)
      : 0;
    const maxRain2 = rain2.length > 0
      ? Math.max(...rain2)
      : 0;

    // Differences
    const tempDiff = avgTemp2 - avgTemp1;
    const rainDiff = totalRain2 - totalRain1;
    const maxRainDiff = maxRain2 - maxRain1;

    const risk1 = loc1.riskLevel ? String(loc1.riskLevel).toUpperCase() : '—';
    const risk2 = loc2.riskLevel ? String(loc2.riskLevel).toUpperCase() : '—';
    const name1 = loc1.name ? String(loc1.name) : 'Location 1';
    const name2 = loc2.name ? String(loc2.name) : 'Location 2';

    // Render comparison
    const content = `
      <div>
        <strong>Comparison</strong>
        <table>
          <thead>
            <tr>
              <th align="left">${name1}</th>
              <th align="left">${name2}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td valign="top">
                ${lat1.toFixed(4)}, ${lng1.toFixed(4)}<br>
                Elevation: ${elevation1}m<br>
                Timezone: ${timezone1}<br><br>
                Risk level: ${risk1}<br><br>
                Avg temp: ${avgTemp1.toFixed(1)}°C<br>
                Total rainfall: ${totalRain1.toFixed(1)}mm<br>
                Max hourly rainfall: ${maxRain1.toFixed(1)}mm
              </td>
              <td valign="top">
                ${lat2.toFixed(4)}, ${lng2.toFixed(4)}<br>
                Elevation: ${elevation2}m<br>
                Timezone: ${timezone2}<br><br>
                Risk level: ${risk2}<br><br>
                Avg temp: ${avgTemp2.toFixed(1)}°C<br>
                Total rainfall: ${totalRain2.toFixed(1)}mm<br>
                Max hourly rainfall: ${maxRain2.toFixed(1)}mm
              </td>
            </tr>
          </tbody>
        </table>
        <br>
        <strong>Differences (Location 2 - Location 1)</strong><br>
        Temperature: ${tempDiff >= 0 ? '+' : ''}${tempDiff.toFixed(1)}°C<br>
        Total rainfall: ${rainDiff >= 0 ? '+' : ''}${rainDiff.toFixed(1)}mm<br>
        Max hourly rainfall: ${maxRainDiff >= 0 ? '+' : ''}${maxRainDiff.toFixed(1)}mm
      </div>
    `;

    // Show comparison
    map.closePopup();
    L.popup()
      .setLatLng([(lat1 + lat2) / 2, (lng1 + lng2) / 2])
      .setContent(content)
      .openOn(map);

    // Reset state
    firstLocation = null;
    secondLocation = null;
    comparisonMode = false;

  } catch (error) {
    console.error('Error comparing locations:', error);
    
    // Error popup
    map.closePopup();
    L.popup()
      .setLatLng([(lat1 + lat2) / 2, (lng1 + lng2) / 2])
      .setContent(`Error\n\nFailed to compare locations.\n${error.message}`)
      .openOn(map);

    // Reset state
    firstLocation = null;
    secondLocation = null;
    comparisonMode = false;
  }
}

/**
 * Select a location via a marker click while in comparison mode.
 * @param {Object} map
 * @param {Object} location - { lat, lng, name?, riskLevel? }
 */
export function selectComparisonLocation(map, location) {
  if (!comparisonMode) return;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return;

  const latitude = location.lat;
  const longitude = location.lng;

  if (!firstLocation) {
    firstLocation = location;
    L.popup()
      .setLatLng([latitude, longitude])
      .setContent(
        `Location 1 selected<br><br><strong>${location.name ?? 'Location 1'}</strong><br>${latitude.toFixed(4)}, ${longitude.toFixed(4)}<br><br>Click another farm marker to compare.`
      )
      .openOn(map);
    return;
  }

  if (!secondLocation) {
    secondLocation = location;
    compareLocations(map, firstLocation, secondLocation);
  }
}

/**
 * Init comparison helpers.
 * @param {Object} map
 */
export function initComparisonHandler(map) {
  // Selection happens from app.js marker clicks.
  console.log('Comparison handler initialized - use startComparison() then click two farm markers');
}

/**
 * Start comparison mode - user will click two locations to compare
 * @param {Object} map - Leaflet map instance
 */
export function startComparison(map) {
  comparisonMode = true;
  firstLocation = null;
  secondLocation = null;
  
  // Show instruction popup
  const center = map.getCenter();
  L.popup()
    .setLatLng(center)
    .setContent('Comparison Mode Active<br><br>Click the first farm marker to compare.')
    .openOn(map);
  
  console.log('Comparison mode started - click two farm markers on the map');
}

/**
 * Stop comparison mode
 */
export function stopComparison() {
  comparisonMode = false;
  firstLocation = null;
  secondLocation = null;
  console.log('Comparison mode stopped');
}

/**
 * Check if comparison mode is active
 * @returns {boolean} True if comparison mode is active
 */
export function isComparisonModeActive() {
  return comparisonMode;
}

