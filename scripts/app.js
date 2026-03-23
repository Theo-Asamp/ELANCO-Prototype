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

// =====================
// Init Map (ONE TIME)
// =====================
const { map, resetView, zoomTo } = initMap();

// =====================
// Side panel elements
// =====================
const panel = document.getElementById("right-panel");
const closeBtn = document.getElementById("close-panel");
const titleEl = document.getElementById("panel-title");
const ownerEl = document.getElementById("panel-owner");
const riskEl = document.getElementById("panel-risk");
const weatherEl = document.getElementById("panel-weather");

// Track selected farm for chatbot context
let selectedFarm = null;

// =====================
// Side panel helpers
// =====================
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

    const maxRain = rainfall.length > 0 ? Math.max(...rainfall) : null;

    const parts = [];
    parts.push(`<strong>Weather summary</strong>`);
    parts.push(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    if (elevation != null) parts.push(`Elevation: ${elevation} m`);
    if (timezone) parts.push(`Timezone: ${timezone}`);
    if (avgTemp != null) parts.push(`Average temperature: ${avgTemp.toFixed(1)} °C`);
    if (totalRain != null) parts.push(`Total rainfall: ${totalRain.toFixed(1)} mm`);
    if (maxRain != null) parts.push(`Max hourly rainfall: ${maxRain.toFixed(1)} mm`);

    // Compute and show risk dynamically from weather
    if (avgTemp != null && totalRain != null && riskEl) {
      const riskLevel = computeRiskLevel(avgTemp, totalRain);

      // store on farm so filters/search can use it (optional)
      farm.riskLevel = riskLevel;

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

  // show risk if already known (e.g. from data.js) – may update after weather loads
  if (riskEl && farm.riskLevel) {
    riskEl.textContent = farm.riskLevel.toUpperCase();
    riskEl.className = "";
    riskEl.classList.add(farm.riskLevel);
  } else if (riskEl) {
    riskEl.textContent = "—";
    riskEl.className = "";
  }

  panel.classList.remove("hidden");
  loadWeatherForFarm(farm);
}

if (closeBtn && panel) {
  closeBtn.addEventListener("click", () => panel.classList.add("hidden"));
}

// =====================
// Markers + Filters + Search
// =====================
const farmMarkers = []; // { marker, riskLevel, farm }

function makeFarmIcon(riskLevel) {
  let pinColor = "#0b5cab";
  if (riskLevel === "low") pinColor = "#1f9d55";
  if (riskLevel === "medium") pinColor = "#f0b429";
  if (riskLevel === "high") pinColor = "#d64545";

  return L.divIcon({
    className: "custom-pin",
    html: `
      <svg width="28" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24s12-15.75 12-24C24 5.373 18.627 0 12 0zm0 17.5c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z" fill="${pinColor}"/>
      </svg>`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
  });
}

function createFarmMarker(map, farm) {
  if (!farm?.location || farm.location.length !== 2) return null;

  // Ensure riskLevel exists for colouring/filtering
  if (!farm.riskLevel) farm.riskLevel = "medium";

  const icon = makeFarmIcon(farm.riskLevel);
  const marker = L.marker(farm.location, { icon }).addTo(map);

  marker.on("click", () => {
    // In comparison mode, marker clicks are used to select locations for comparison.
    if (isComparisonModeActive()) {
      const [lat, lng] = farm.location;
      selectComparisonLocation(map, { lat, lng, name: farm.name });
      return;
    }

    selectedFarm = farm;
    openPanel(farm);
    map.flyTo(farm.location, 14, { duration: 1.5 });
  });

  farmMarkers.push({ marker, riskLevel: farm.riskLevel, farm });
  return marker;
}

// Add markers for existing mock farms
mockFarms.forEach((farm) => createFarmMarker(map, farm));

// ---------------------
// CSV support (optional)
// ---------------------
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length < 2) continue;

    const row = {};
    headers.forEach((h, idx) => (row[h] = (values[idx] ?? "").trim()));
    rows.push(row);
  }

  return rows;
}

async function loadFarmsFromCsv(map, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return;

    const text = await response.text();
    const rows = parseCsv(text);

    rows.forEach((row, index) => {
      const latRaw = row.latitude || row.lat;
      const lonRaw = row.longitude || row.lon || row.lng;

      const latitude = parseFloat(latRaw);
      const longitude = parseFloat(lonRaw);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const farm = {
        id: row.id || row.farm_id || `csv_${index}`,
        name: row.name || row.farm_name || `Farm ${index + 1}`,
        owner: row.owner || row.farmer || "",
        riskLevel: row.risklevel || row.risk || "medium", // optional column
        location: [latitude, longitude],
      };

      createFarmMarker(map, farm);
    });
  } catch (error) {
    console.error("Failed to load farms from CSV:", error);
  }
}

// If you have a CSV in the root, this will load it. If not, it's ignored.
loadFarmsFromCsv(map, "./farms.csv");

// ---------------------
// Filter logic
// ---------------------
const filterCheckboxes = document.querySelectorAll('#risk-filters input[type="checkbox"]');

function updateFilters() {
  if (!filterCheckboxes?.length) return;

  const activeFilters = [];
  filterCheckboxes.forEach((box) => box.checked && activeFilters.push(box.value));

  farmMarkers.forEach((item) => {
    // Keep the marker riskLevel in sync if farm.riskLevel changed dynamically
    item.riskLevel = item.farm.riskLevel || item.riskLevel;

    const shouldShow = activeFilters.includes(item.riskLevel);
    const isOnMap = map.hasLayer(item.marker);

    if (shouldShow && !isOnMap) item.marker.addTo(map);
    if (!shouldShow && isOnMap) item.marker.remove();
  });
}

filterCheckboxes.forEach((box) => box.addEventListener("change", updateFilters));

// ---------------------
// Search logic
// ---------------------
const searchInput = document.getElementById("search");
const searchResults = document.getElementById("search-results");

if (searchInput && searchResults) {
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    searchResults.innerHTML = "";

    if (!query) {
      searchResults.classList.add("hidden");
      return;
    }

    const farms = farmMarkers.map((x) => x.farm);
    const matches = farms.filter(
      (farm) =>
        farm.name.toLowerCase().includes(query) ||
        String(farm.id).toLowerCase().includes(query)
    );

    if (matches.length) {
      searchResults.classList.remove("hidden");

      matches.forEach((farm) => {
        const li = document.createElement("li");
        li.textContent = `${farm.name} (${farm.id})`;

        li.addEventListener("click", () => {
          searchInput.value = farm.name;
          searchResults.classList.add("hidden");

          selectedFarm = farm;
          openPanel(farm);
          map.flyTo(farm.location, 14, { duration: 1.5 });
        });

        searchResults.appendChild(li);
      });
    } else {
      searchResults.classList.add("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add("hidden");
    }
  });
}

// =====================
// Comparison init
// =====================
initComparisonHandler(map);
initComparisonUI(map);

window.startComparison = () => startComparison(map);
window.stopComparison = stopComparison;
window.isComparisonModeActive = isComparisonModeActive;

// =====================
// Chatbot init
// =====================
initChatbot({
  getContext: () => ({ selectedFarm }),
  onAction: (action) => {
    if (action.type === "resetView") resetView();
    if (action.type === "zoomTo" && action.value) zoomTo(action.value);
    console.log("Chat action:", action);
  }
});