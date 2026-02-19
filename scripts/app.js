import { initMap } from "./map.js";
import { initChatbot } from "./chatbot.js";

const { resetView, zoomTo } = initMap();

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
