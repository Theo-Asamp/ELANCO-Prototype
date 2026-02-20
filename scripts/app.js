import { initMap } from "./map.js";
import {
  initComparisonHandler,
  selectComparisonLocation,
  startComparison,
  stopComparison,
  isComparisonModeActive,
} from "./compare.js";
import { initComparisonUI } from "./compareUI.js";
import { initChatbot } from "./chatbot.js";
import { mockFarms } from "./data.js";
import { getOpenMeteoTemperatureAndRainfall } from "./api.js";
import { computeRiskLevel } from "./utils.js";

// Initialize the application
const { map, resetView, zoomTo } = initMap();

const panel = document.getElementById("right-panel");
const closeBtn = document.getElementById("close-panel");
const titleEl = document.getElementById("panel-title");
const ownerEl = document.getElementById("panel-owner");
const riskEl = document.getElementById("panel-risk");
const weatherEl = document.getElementById("panel-weather");

async function loadWeatherForFarm(farm) {
  if (!weatherEl || !farm?.location || farm.location.length !== 2) return;

  const [latitude, longitude] = farm.location;

  weatherEl.textContent = "Loading weather data...";

  try {
    const weather = await getOpenMeteoTemperatureAndRainfall(latitude, longitude);

    const temperatures = weather.temperature_2m ?? [];
    const rainfall = weather.precipitation ?? [];
    const timezone = weather.timezone;
    const elevation = weather.elevation;

    const avgTemp =
      temperatures.length > 0
        ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
        : null;
    const totalRain =
      rainfall.length > 0 ? rainfall.reduce((a, b) => a + b, 0) : null;
    const maxRain =
      rainfall.length > 0 ? Math.max(...rainfall) : null;

    const parts = [];
    parts.push(`<strong>Weather summary</strong>`);
    parts.push(
      `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    );
    if (elevation != null) {
      parts.push(`Elevation: ${elevation} m`);
    }
    if (timezone) {
      parts.push(`Timezone: ${timezone}`);
    }
    if (avgTemp != null) {
      parts.push(`Average temperature: ${avgTemp.toFixed(1)} °C`);
    }
    if (totalRain != null) {
      parts.push(`Total rainfall: ${totalRain.toFixed(1)} mm`);
    }
    if (maxRain != null) {
      parts.push(`Max hourly rainfall: ${maxRain.toFixed(1)} mm`);
    }

    // Compute and display risk based on weather
    if (avgTemp != null && totalRain != null && riskEl) {
      const riskLevel = computeRiskLevel(avgTemp, totalRain);
      riskEl.textContent = riskLevel.toUpperCase();
      riskEl.className = "";
      riskEl.classList.add(riskLevel);
      parts.push(`Risk level: ${riskLevel.toUpperCase()}`);
    }

    weatherEl.innerHTML = parts.join("<br>");
  } catch (error) {
    console.error("Error loading weather for farm:", error);
    weatherEl.textContent = "Unable to load weather data for this location.";
  }
}

function openPanel(farm) {
  if (!panel) return;

  titleEl.textContent = farm.name;
  ownerEl.textContent = farm.owner ?? "";
  panel.classList.remove("hidden");

   // Load weather details for this farm
  loadWeatherForFarm(farm);
}

if (closeBtn && panel) {
  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });
}

function createFarmMarker(map, farm) {
  if (!farm?.location || farm.location.length !== 2) return null;

  const marker = L.marker(farm.location).addTo(map);

  marker.on("click", () => {
    // In comparison mode, marker clicks are used to select locations for comparison.
    if (isComparisonModeActive()) {
      const [lat, lng] = farm.location;
      selectComparisonLocation(map, {
        lat,
        lng,
        name: farm.name,
      });
      return;
    }

    openPanel(farm);
    map.flyTo(farm.location, 10);
  });

  return marker;
}

// Existing mock farms (fallback / demo data)
mockFarms.forEach((farm) => {
  createFarmMarker(map, farm);
});

// --- CSV support: load additional farms from a CSV file and add markers ---

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase());

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length < 2) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

async function loadFarmsFromCsv(map, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("Could not load farms CSV:", url, response.status);
      return;
    }

    const text = await response.text();
    const rows = parseCsv(text);

    rows.forEach((row, index) => {
      // Try multiple common column names, case-insensitive
      const latRaw = row.latitude || row.lat;
      const lonRaw = row.longitude || row.lon || row.lng;

      const latitude = parseFloat(latRaw);
      const longitude = parseFloat(lonRaw);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return; // skip rows without valid coordinates
      }

      const farm = {
        id: row.id || row.farm_id || `csv_${index}`,
        name: row.name || row.farm_name || `Farm ${index + 1}`,
        owner: row.owner || row.farmer || "",
        location: [latitude, longitude],
      };

      createFarmMarker(map, farm);
    });
  } catch (error) {
    console.error("Failed to load farms from CSV:", error);
  }
}

// Change this path to where your CSV lives relative to index.html
// Expected headers (case-insensitive): name, owner, latitude, longitude
loadFarmsFromCsv(map, "./farms.csv");

// Initialize comparison functionality first
initComparisonHandler(map);

// NOTE: We intentionally do not enable "click anywhere on the map to see weather".
// Weather is loaded only when clicking on farm markers (pointers), and displayed in the side panel.

// Initialize comparison UI
initComparisonUI(map);

// Expose comparison functions to window for easy access (still available via console)
window.startComparison = () => startComparison(map);
window.stopComparison = stopComparison;
window.isComparisonModeActive = isComparisonModeActive;

// Initialize chatbot
initChatbot({
  getContext: () => ({
    selectedFarm: null
  }),
  onAction: (action) => {
    if (action.type === "resetView") resetView();
    if (action.type === "zoomTo" && action.value) zoomTo(action.value);
    console.log("Chat action:", action);
  }
});
