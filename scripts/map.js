export function initMap() {
  const ukCenter = [54.5, -3.2];

  const map = L.map("map", { zoomControl: true }).setView(ukCenter, 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 0);

  function resetView() {
    map.setView(ukCenter, 6);
  }

  function zoomTo({ lat, lng, zoom = 11 }) {
    map.setView([lat, lng], zoom);
  }

  return { map, resetView, zoomTo };
}
