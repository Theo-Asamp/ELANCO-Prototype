export function initMap() {
  const ukCenter = [54.5, -3.2];
  const defaultZoom = 6;

  const map = L.map("map", { zoomControl: true }).setView(ukCenter, defaultZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 0);

  function resetView() {
    map.setView(ukCenter, defaultZoom);
  }

  function zoomTo({ lat, lng, zoom = 11 }) {
    map.setView([lat, lng], zoom);
  }

  const HomeControl = L.Control.extend({
    options: {
      position: "topleft"
    },

    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-home-control");
      const button = L.DomUtil.create("a", "leaflet-home-button", container);

      button.href = "#";
      button.title = "Reset map view";
      button.setAttribute("aria-label", "Reset map view");
      button.innerHTML = "⌂";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, "click", (e) => {
        L.DomEvent.preventDefault(e);
        resetView();
      });

      return container;
    }
  });

  map.addControl(new HomeControl());

  return { map, resetView, zoomTo };
}