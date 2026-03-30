import { mockFarms } from "./data.js";

// =====================
// Helpers
// =====================
function loadAllFarms() {
  const custom = JSON.parse(localStorage.getItem("elanco_custom_farms") || "[]");
  return [...mockFarms, ...custom];
}

// =====================
// Import – Parse CSV
// =====================
let parsedRows = [];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2)
    throw new Error("CSV must have a header row and at least one data row.");

  const parseRow = (line) => {
    const cols = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ""));

  const required = ["name", "latitude", "longitude"];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length)
    throw new Error(`Missing required column(s): ${missing.join(", ")}`);

  const idx = {
    name:  headers.indexOf("name"),
    owner: headers.indexOf("owner"),
    lat:   headers.indexOf("latitude"),
    lng:   headers.indexOf("longitude"),
  };

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const cols = parseRow(line);
      const name  = cols[idx.name]  || "";
      const owner = idx.owner >= 0 ? (cols[idx.owner] || "") : "";
      const lat   = parseFloat(cols[idx.lat]);
      const lng   = parseFloat(cols[idx.lng]);

      const errors = [];
      if (!name)                           errors.push("Name is required");
      if (isNaN(lat) || lat < 48 || lat > 62) errors.push("Latitude out of UK range");
      if (isNaN(lng) || lng < -9 || lng > 3)  errors.push("Longitude out of UK range");

      return { name, owner, lat, lng, valid: errors.length === 0, errors };
    });
}

function renderImportPreview(rows) {
  const wrap    = document.getElementById("import-preview-wrap");
  const tbody   = document.getElementById("import-tbody");
  const saveBtn = document.getElementById("save-import-btn");
  const clearBtn = document.getElementById("clear-import-btn");

  wrap.style.display = "block";
  clearBtn.style.display = "inline-flex";

  const valid = rows.filter((r) => r.valid).length;

  tbody.innerHTML = rows
    .map(
      (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.name || '<em style="color:var(--muted)">missing</em>'}</td>
      <td>${r.owner || "—"}</td>
      <td>${isNaN(r.lat) ? "—" : r.lat.toFixed(4)}</td>
      <td>${isNaN(r.lng) ? "—" : r.lng.toFixed(4)}</td>
      <td>${
        r.valid
          ? `<span style="color:var(--low);font-weight:700;">✓ Valid</span>`
          : `<span style="color:var(--high);font-weight:700;" title="${r.errors.join(", ")}">✗ ${r.errors[0]}</span>`
      }</td>
    </tr>`
    )
    .join("");

  saveBtn.disabled = valid === 0;
  saveBtn.textContent =
    valid > 0 ? `✅ Add ${valid} farm${valid !== 1 ? "s" : ""} to Map` : "✅ Add to Map";
}

function showStatus(msg, type) {
  const el = document.getElementById("import-status");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
}

function processFile(file) {
  if (!file || !file.name.toLowerCase().endsWith(".csv")) {
    showStatus("Please upload a valid .csv file.", "error");
    return;
  }

  const nameEl = document.getElementById("dz-filename");
  nameEl.textContent = file.name;
  nameEl.style.display = "inline-block";

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      parsedRows = parseCSV(e.target.result);
      renderImportPreview(parsedRows);
      const valid = parsedRows.filter((r) => r.valid).length;
      showStatus(
        `Parsed ${parsedRows.length} row(s) — ${valid} valid, ${parsedRows.length - valid} with errors.`,
        valid > 0 ? "success" : "error"
      );
    } catch (err) {
      showStatus(`Parse error: ${err.message}`, "error");
    }
  };
  reader.readAsText(file);
}

function saveImport() {
  const existing = JSON.parse(localStorage.getItem("elanco_custom_farms") || "[]");
  const allFarms = loadAllFarms();
  let nextNum = allFarms.length + existing.length + 1;

  const newFarms = parsedRows
    .filter((r) => r.valid)
    .map((r) => ({
      id: `custom_${String(nextNum++).padStart(3, "0")}`,
      name: r.name,
      owner: r.owner || "Imported",
      location: [r.lat, r.lng],
      riskLevel: "medium", // placeholder — recomputed by weather API on map load
    }));

  const updated = [...existing, ...newFarms];
  localStorage.setItem("elanco_custom_farms", JSON.stringify(updated));

  showStatus(`✅ ${newFarms.length} farm(s) added! Redirecting to map…`, "success");
  setTimeout(() => { window.location.href = "index.html"; }, 1600);
}

function clearImportUI() {
  parsedRows = [];
  document.getElementById("import-preview-wrap").style.display = "none";
  document.getElementById("import-status").className = "status-msg hidden";
  document.getElementById("save-import-btn").disabled = true;
  document.getElementById("clear-import-btn").style.display = "none";
  document.getElementById("dz-filename").style.display = "none";
  document.getElementById("file-input").value = "";
}

// =====================
// Init
// =====================
function init() {
  // Drop zone
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover",  (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    processFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", (e) => processFile(e.target.files[0]));

  // Import save / clear
  document.getElementById("save-import-btn").addEventListener("click", saveImport);
  document.getElementById("clear-import-btn").addEventListener("click", clearImportUI);
}

init();
