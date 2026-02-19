import { initMap } from "./map.js";
import { mockFarms } from "./data.js";

const map = initMap();

const panel = document.getElementById("right-panel");
const closeBtn = document.getElementById("close-panel");
const titleEl = document.getElementById("panel-title");
const ownerEl = document.getElementById("panel-owner");
const riskEl = document.getElementById("panel-risk");

function openPanel(farm) {

  titleEl.textContent = farm.name;
  ownerEl.textContent = farm.owner;
  riskEl.textContent = farm.riskLevel.toUpperCase();
  
  riskEl.className = ""; 
  riskEl.classList.add(farm.riskLevel); 
  panel.classList.remove("hidden");
}

closeBtn.addEventListener("click", () => {
  panel.classList.add("hidden");
});

mockFarms.forEach(farm => {
  const marker = L.marker(farm.location).addTo(map);

  marker.on("click", () => {
    openPanel(farm);
    
    map.flyTo(farm.location, 10); 
  });
});