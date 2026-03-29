import { initMap } from "./map.js";
import { initChatbot } from "./chatbot.js";
import { mockFarms } from "./data.js";
import { getOpenMeteoTemperatureAndRainfall } from "./api.js";
import { computeParasiteRiskLevel, getParasiteRiskBreakdown } from "./utils.js";

// Merge any farms imported via the Import / Export page
const _customFarms = JSON.parse(localStorage.getItem("elanco_custom_farms") || "[]");
_customFarms.forEach(f => mockFarms.push(f));


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
const parasiteSelect = document.getElementById("parasite-select");

// Track selected farm
let selectedFarm = null;

// Default parasite
let selectedParasite = parasiteSelect?.value || "roundworms";

// =====================
// Parasite content
// =====================
const parasiteInfo = {
  average: {
    label: "Average (All Parasites)",
    why:
      "This risk level is an equal-weight average across roundworms, lungworms, liver flukes, coccidia, and lice using the same weather and elevation-adjusted temperature window.",
    mitigation: [
      "Use this as a broad overview, then switch to each parasite for detail",
      "Prioritise monitoring when the average is medium or high",
      "Consider farm history and age groups when interpreting combined risk",
      "Discuss targeted actions with your vet or advisor",
    ],
  },
  roundworms: {
    label: "Gastrointestinal Roundworms",
    why:
      "This risk level is influenced by recent rainfall and temperature conditions, which can support the survival and spread of gastrointestinal roundworm larvae on pasture.",
    mitigation: [
      "Rotate grazing areas",
      "Monitor livestock regularly",
      "Avoid overstocking pasture",
      "Seek veterinary advice if risk increases",
    ],
  },
  lungworms: {
    label: "Lungworms",
    why:
      "This risk level is influenced by recent rainfall and temperature conditions, which can increase the survival and transmission of lungworm larvae in grazing environments.",
    mitigation: [
      "Monitor cattle for coughing or breathing changes",
      "Rotate grazing areas",
      "Reduce exposure to heavily grazed pasture",
      "Seek veterinary advice if symptoms appear",
    ],
  },
  flukes: {
    label: "Liver Flukes",
    why:
      "This risk level is influenced by recent rainfall and temperature conditions, which can favour wet ground and support environments linked to liver fluke transmission.",
    mitigation: [
      "Avoid wet or poorly drained grazing areas",
      "Monitor livestock regularly",
      "Manage pasture and drainage where possible",
      "Seek veterinary advice if risk increases",
    ],
  },
  coccidia: {
    label: "Coccidia",
    why:
      "This risk level is influenced by recent rainfall and temperature conditions, which may increase environmental contamination and support coccidia survival.",
    mitigation: [
      "Maintain pasture and housing hygiene",
      "Avoid overcrowding",
      "Monitor younger animals closely",
      "Seek veterinary advice if risk increases",
    ],
  },
  lice: {
    label: "Lice",
    why:
      "This risk level is influenced by recent environmental conditions, which may affect stress, close contact, and parasite persistence within livestock groups.",
    mitigation: [
      "Inspect coats and skin regularly",
      "Reduce close-contact spread where possible",
      "Maintain good hygiene and animal condition",
      "Seek veterinary advice if infestation is suspected",
    ],
  },
};

// =====================
// Weather + Risk Logic
// =====================
async function getFarmWeatherSummary(farm) {
  if (!farm?.location || farm.location.length !== 2) {
    return null;
  }

  const [latitude, longitude] = farm.location;
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

  return {
    latitude,
    longitude,
    timezone,
    elevation,
    avgTemp,
    totalRain,
    maxRain,
  };
}

function renderWhyAndMitigation(elevation = null, breakdown = null) {
  const info = parasiteInfo[selectedParasite] || parasiteInfo.roundworms;
  const componentLevels = breakdown?.componentLevels;
  const shortWhy = info.why || "Risk is based on recent environmental conditions.";

  const modelDetailDropdown =
    breakdown?.notes?.length
      ? `
      <details class="weather-dropdown">
        <summary>Model detail</summary>
        <div class="weather-dropdown-content">
          ${breakdown.notes.map((n) => `<div>• ${n}</div>`).join("")}
        </div>
      </details>`
      : "";

  const averageComponentsDropdown = componentLevels
    ? `
      <details class="weather-dropdown">
        <summary>Average components</summary>
        <div class="weather-dropdown-content">
          <div>Roundworms: ${componentLevels.roundworms?.toUpperCase() || "LOW"}</div>
          <div>Lungworms: ${componentLevels.lungworms?.toUpperCase() || "LOW"}</div>
          <div>Liver Flukes: ${componentLevels.flukes?.toUpperCase() || "LOW"}</div>
          <div>Coccidia: ${componentLevels.coccidia?.toUpperCase() || "LOW"}</div>
          <div>Lice: ${componentLevels.lice?.toUpperCase() || "LOW"}</div>
        </div>
      </details>`
    : "";

  if (whyEl) {
    whyEl.innerHTML = `
      <strong>Why this risk?</strong><br>
      ${shortWhy}
      ${elevation != null ? `<br><span class="small">Site elevation: ${elevation} m.</span>` : ""}
      ${averageComponentsDropdown}
      ${modelDetailDropdown}
    `;
  }

  if (mitigationEl) {
    mitigationEl.innerHTML = `
      <strong>How to mitigate</strong><br>
      ${info.mitigation.map(item => `- ${item}`).join("<br>")}
    `;
  }
}

async function loadWeatherForFarm(farm) {
  if (!weatherEl) return;

  weatherEl.textContent = "Loading weather data...";

  try {
    const summary = await getFarmWeatherSummary(farm);

    if (!summary) {
      weatherEl.textContent = "Unable to load weather data.";
      return;
    }

    const {
      latitude,
      longitude,
      timezone,
      elevation,
      avgTemp,
      totalRain,
      maxRain,
    } = summary;

    const weatherDetails = [];
    weatherDetails.push(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    if (elevation != null) weatherDetails.push(`Elevation: ${elevation} m`);
    if (timezone) weatherDetails.push(`Timezone: ${timezone}`);
    if (avgTemp != null) weatherDetails.push(`Average temperature: ${avgTemp.toFixed(1)} °C`);
    if (totalRain != null) weatherDetails.push(`Total rainfall: ${totalRain.toFixed(1)} mm`);
    if (maxRain != null) weatherDetails.push(`Max hourly rainfall: ${maxRain.toFixed(1)} mm`);

    if (avgTemp != null && totalRain != null && riskEl) {
      const riskLevel = computeParasiteRiskLevel(
        avgTemp,
        totalRain,
        maxRain,
        elevation,
        selectedParasite
      );
      farm.riskLevel = riskLevel;
      farm.lastWeatherSummary = summary;

      const breakdown = getParasiteRiskBreakdown(
        avgTemp,
        totalRain,
        maxRain,
        elevation,
        selectedParasite
      );
      farm.lastRiskBreakdown = breakdown;

      riskEl.textContent = riskLevel.toUpperCase();
      riskEl.className = "";
      riskEl.classList.add("badge");
      riskEl.classList.add(riskLevel);

      renderWhyAndMitigation(elevation, breakdown);
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

async function calculateRiskForFarm(farm) {
  if (!farm?.location || farm.location.length !== 2) {
    farm.riskLevel = "low";
    return;
  }

  try {
    const summary = await getFarmWeatherSummary(farm);

    if (!summary || summary.avgTemp == null || summary.totalRain == null) {
      farm.riskLevel = "low";
      return;
    }

    farm.lastWeatherSummary = summary;
    farm.riskLevel = computeParasiteRiskLevel(
      summary.avgTemp,
      summary.totalRain,
      summary.maxRain,
      summary.elevation,
      selectedParasite
    );
    farm.lastRiskBreakdown = getParasiteRiskBreakdown(
      summary.avgTemp,
      summary.totalRain,
      summary.maxRain,
      summary.elevation,
      selectedParasite
    );
  } catch (error) {
    console.error(`Failed to calculate risk for ${farm.name}:`, error);
    farm.riskLevel = "low";
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

  const marker = L.marker(farm.location, {
    icon: makeFarmIcon(farm.riskLevel || "low"),
  }).addTo(map);

  marker.bindTooltip(farm.name, {
    direction: "top",
    offset: [0, -36],
    opacity: 1,
    permanent: false,
    className: "farm-hover-tooltip",
  });

  marker.on("mouseover", () => {
    marker.openTooltip();
  });

  marker.on("mouseout", () => {
    marker.closeTooltip();
  });

  marker.on("click", () => {
    selectedFarm = farm;
    openPanel(farm);
    map.flyTo(farm.location, 14, { duration: 1.5 });
  });

  farmMarkers.push({ marker, farm });
}

function clearFarmMarkers() {
  farmMarkers.forEach(({ marker }) => {
    if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });
  farmMarkers.length = 0;
}

async function refreshFarmRisks() {
  clearFarmMarkers();

  await Promise.all(mockFarms.map(farm => calculateRiskForFarm(farm)));

  mockFarms.forEach(farm => createFarmMarker(map, farm));
  updateFilters();

  // Persist live-computed risk levels so the export page stays in sync
  const riskCache = {};
  mockFarms.forEach(f => { riskCache[f.id] = f.riskLevel; });
  localStorage.setItem("elanco_risk_cache", JSON.stringify(riskCache));

  if (selectedFarm) {
    const updatedFarm = mockFarms.find(f => f.id === selectedFarm.id);
    if (updatedFarm) {
      selectedFarm = updatedFarm;
      openPanel(updatedFarm);
    }
  }
}

// =====================
// Filters
// =====================
const filterCheckboxes = document.querySelectorAll('#risk-filters input');

function updateFilters() {
  const active = [];
  filterCheckboxes.forEach(box => {
    if (box.checked) active.push(box.value);
  });

  farmMarkers.forEach(item => {
    const risk = item.farm.riskLevel || "low";

    if (active.includes(risk)) {
      if (!map.hasLayer(item.marker)) item.marker.addTo(map);
    } else {
      if (map.hasLayer(item.marker)) item.marker.remove();
    }
  });
}

filterCheckboxes.forEach(box => box.addEventListener("change", updateFilters));

// =====================
// Parasite selection
// =====================
parasiteSelect?.addEventListener("change", async (e) => {
  selectedParasite = e.target.value;

  if (selectedFarm?.lastWeatherSummary) {
    const s = selectedFarm.lastWeatherSummary;
    const b = getParasiteRiskBreakdown(
      s.avgTemp,
      s.totalRain,
      s.maxRain,
      s.elevation,
      selectedParasite
    );
    selectedFarm.lastRiskBreakdown = b;
    renderWhyAndMitigation(s.elevation, b);
  }

  await refreshFarmRisks();
});

// =====================
// Search
// =====================
const searchInput = document.getElementById("search");
const searchResults = document.getElementById("search-results");

searchInput?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  searchResults.innerHTML = "";

  if (!query) {
    searchResults.classList.add("hidden");
    return;
  }

  const matches = mockFarms.filter(farm =>
    farm.name.toLowerCase().includes(query)
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
// Initial load
// =====================
refreshFarmRisks();

// =====================
// Chatbot
// =====================
initChatbot({
  getContext: () => ({
    selectedFarm,
    selectedParasite,
    selectedParasiteLabel:
      parasiteInfo[selectedParasite]?.label || "Gastrointestinal Roundworms",
  }),
  onAction: (action) => {
    if (action.type === "resetView") resetView();
    if (action.type === "zoomTo" && action.value) zoomTo(action.value);
  },
});