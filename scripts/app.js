import { initMap } from "./map.js";
import { initChatbot } from "./chatbot.js";
import { mockFarms } from "./data.js";
import { getOpenMeteoTemperatureAndRainfall } from "./api.js";
import { computeRiskLevel } from "./utils.js";

// =====================
// Init Map
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
const whyEl = document.getElementById("panel-why");
const mitigationEl = document.getElementById("panel-mitigation");

// Track selected farm (for chatbot later)
let selectedFarm = null;

// =====================
// Weather + Risk Logic
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

    const maxRain =
      rainfall.length > 0 ? Math.max(...rainfall) : null;

    const weatherDetails = [];
    weatherDetails.push(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    if (elevation != null) weatherDetails.push(`Elevation: ${elevation} m`);
    if (timezone) weatherDetails.push(`Timezone: ${timezone}`);
    if (avgTemp != null) weatherDetails.push(`Average temperature: ${avgTemp.toFixed(1)} °C`);
    if (totalRain != null) weatherDetails.push(`Total rainfall: ${totalRain.toFixed(1)} mm`);
    if (maxRain != null) weatherDetails.push(`Max hourly rainfall: ${maxRain.toFixed(1)} mm`);

    // Compute risk
    if (avgTemp != null && totalRain != null && riskEl) {
      const riskLevel = computeRiskLevel(avgTemp, totalRain);

      farm.riskLevel = riskLevel;

      riskEl.textContent = riskLevel.toUpperCase();
      riskEl.className = "";
      riskEl.classList.add("badge");
      riskEl.classList.add(riskLevel);

      // WHY + MITIGATION UI
      if (whyEl && mitigationEl) {
        whyEl.innerHTML = `
          <strong>Why this risk?</strong><br>
          This risk level is influenced by recent rainfall and temperature conditions, which affect parasite survival and spread.
          ${elevation ? `<br>Elevation (${elevation} m) may also impact parasite development.` : ""}
        `;

        mitigationEl.innerHTML = `
          <strong>How to mitigate</strong><br>
          - Rotate grazing areas<br>
          - Monitor livestock regularly<br>
          - Maintain pasture hygiene<br>
          - Seek veterinary advice if risk increases
        `;
      }
    }
    weatherEl.innerHTML = `
  <details class="weather-dropdown">
    <summary>Weather summary</summary>
    <div class="weather-dropdown-content">
      ${weatherDetails.map(item => `<div>${item}</div>`).join("")}
    </div>
  </details>
`;
    
  } catch (error) {
    console.error("Error loading weather:", error);
    weatherEl.textContent = "Unable to load weather data.";
  }
}

// =====================
// Panel logic
// =====================
function openPanel(farm) {
  if (!panel) return;

  titleEl.textContent = farm.name;
  ownerEl.textContent = farm.owner ?? "";

  if (riskEl && farm.riskLevel) {
    riskEl.textContent = farm.riskLevel.toUpperCase();
    riskEl.className = "";
    riskEl.classList.add("badge");
    riskEl.classList.add(farm.riskLevel);
  } else if (riskEl) {
    riskEl.textContent = "—";
    riskEl.className = "";
  }

  panel.classList.remove("hidden");
  loadWeatherForFarm(farm);
}

closeBtn?.addEventListener("click", () => {
  panel.classList.add("hidden");
});

// =====================
// Markers
// =====================
const farmMarkers = [];

function makeFarmIcon(riskLevel) {
  let color = "#0b5cab";
  if (riskLevel === "low") color = "#1f9d55";
  if (riskLevel === "medium") color = "#f0b429";
  if (riskLevel === "high") color = "#d64545";

  return L.divIcon({
    className: "custom-pin",
    html: `
      <svg width="28" height="42" viewBox="0 0 24 36">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24s12-15.75 12-24C24 5.373 18.627 0 12 0z" fill="${color}"/>
      </svg>`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
  });
}

function createFarmMarker(map, farm) {
  if (!farm.location) return;

  if (!farm.riskLevel) farm.riskLevel = "medium";

  const marker = L.marker(farm.location, {
    icon: makeFarmIcon(farm.riskLevel),
  }).addTo(map);

  marker.on("click", () => {
    selectedFarm = farm;
    openPanel(farm);
    map.flyTo(farm.location, 14, { duration: 1.5 });
  });

  farmMarkers.push({ marker, farm });
}

// Load mock farms
mockFarms.forEach(farm => createFarmMarker(map, farm));

// =====================
// Filters
// =====================
const filterCheckboxes = document.querySelectorAll('#risk-filters input');

function updateFilters() {
  const active = [];
  filterCheckboxes.forEach(box => box.checked && active.push(box.value));

  farmMarkers.forEach(item => {
    const risk = item.farm.riskLevel || "medium";

    if (active.includes(risk)) {
      if (!map.hasLayer(item.marker)) item.marker.addTo(map);
    } else {
      if (map.hasLayer(item.marker)) item.marker.remove();
    }
  });
}

filterCheckboxes.forEach(box => box.addEventListener("change", updateFilters));

// =====================
// Search
// =====================
const searchInput = document.getElementById("search");
const searchResults = document.getElementById("search-results");

searchInput?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  searchResults.innerHTML = "";

  if (!query) return searchResults.classList.add("hidden");

  const matches = mockFarms.filter(f =>
    f.name.toLowerCase().includes(query)
  );

  matches.forEach(farm => {
    const li = document.createElement("li");
    li.textContent = farm.name;

    li.onclick = () => {
      selectedFarm = farm;
      openPanel(farm);
      map.flyTo(farm.location, 14);
      searchResults.classList.add("hidden");
    };

    searchResults.appendChild(li);
  });

  searchResults.classList.remove("hidden");
});

// =====================
// Chatbot
// =====================
initChatbot({
  getContext: () => ({ selectedFarm }),
  onAction: (action) => {
    if (action.type === "resetView") resetView();
    if (action.type === "zoomTo" && action.value) zoomTo(action.value);
  }
});