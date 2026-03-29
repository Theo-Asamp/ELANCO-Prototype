/**
 * Simple rule-based parasite risk (prototype).
 * Uses the same style as the original: fixed temperature + rainfall bands.
 * Elevation is handled as a separate direct modifier (not temperature lapse).
 */

/** @typedef {"low"|"medium"|"high"} RiskLevel */

const PARASITE_IDS = new Set([
  "average",
  "roundworms",
  "lungworms",
  "flukes",
  "coccidia",
  "lice",
]);

const BASE_PARASITE_IDS = ["roundworms", "lungworms", "flukes", "coccidia", "lice"];

/**
 * Per-parasite { high, medium } rectangles in (effectiveTemp °C, totalRain mm).
 * High is checked first, then medium; otherwise low.
 * @type {Record<string, { high: object, medium: object }>}
 */
const THRESHOLDS = {
  // Baseline GI nematodes — same idea as the original prototype
  roundworms: {
    high: { tMin: 10, tMax: 20, rMin: 20, rMax: 120 },
    medium: { tMin: 5, tMax: 25, rMin: 10, rMax: 150 },
  },
  // Needs wetter grass — stricter on rain for “high”
  lungworms: {
    high: { tMin: 10, tMax: 20, rMin: 30, rMax: 130 },
    medium: { tMin: 5, tMax: 25, rMin: 12, rMax: 160 },
  },
  // Snails / wet ground — high rain, mild temps
  flukes: {
    high: { tMin: 8, tMax: 22, rMin: 40, rMax: 220 },
    medium: { tMin: 5, tMax: 25, rMin: 18, rMax: 250 },
  },
  // Warmer + moisture for sporulation
  coccidia: {
    high: { tMin: 14, tMax: 26, rMin: 15, rMax: 110 },
    medium: { tMin: 8, tMax: 28, rMin: 8, rMax: 140 },
  },
  // Mostly contact; weather only loosely — narrow “high”, rarely hits
  lice: {
    high: { tMin: 5, tMax: 16, rMin: 5, rMax: 90 },
    medium: { tMin: 0, tMax: 22, rMin: 0, rMax: 120 },
  },
};

function inBand(tEff, rain, band) {
  return (
    tEff >= band.tMin &&
    tEff <= band.tMax &&
    rain >= band.rMin &&
    rain <= band.rMax
  );
}

function simpleParasiteLevel(tEff, rain, parasiteId) {
  const rules = THRESHOLDS[parasiteId] || THRESHOLDS.roundworms;
  if (inBand(tEff, rain, rules.high)) return "high";
  if (inBand(tEff, rain, rules.medium)) return "medium";
  return "low";
}

function levelToScore(level) {
  if (level === "high") return 1;
  if (level === "medium") return 0.5;
  return 0;
}

function scoreToLevel(score) {
  if (score >= 0.67) return "high";
  if (score >= 0.34) return "medium";
  return "low";
}

/**
 * Elevation modifier applied after base parasite level.
 * Positive = risk up, negative = risk down.
 * Kept small (max +/-0.2 score) to remain a secondary factor.
 */
function elevationModifier(parasiteId, elevationM) {
  if (!Number.isFinite(elevationM)) return 0;
  const el = Math.max(0, elevationM);

  // Step-like simple rules to keep behaviour transparent.
  if (parasiteId === "flukes") {
    if (el >= 500) return 0.2;
    if (el >= 250) return 0.1;
    return 0;
  }

  if (parasiteId === "lice") {
    if (el >= 500) return 0.1;
    return 0;
  }

  // Most pasture-stage parasites slightly less favoured at higher altitude.
  if (el >= 500) return -0.2;
  if (el >= 250) return -0.1;
  return 0;
}

function adjustedLevel(baseLevel, parasiteId, elevationM) {
  const baseScore = levelToScore(baseLevel);
  const adjustedScore = Math.max(
    0,
    Math.min(1, baseScore + elevationModifier(parasiteId, elevationM))
  );
  return scoreToLevel(adjustedScore);
}

/**
 * @param {number} avgTempC
 * @param {number} totalRainMm
 * @param {number|null|undefined} _maxHourlyRainMm — unused (kept for API stability)
 * @param {number|null|undefined} elevationM
 * @param {string} parasiteId
 * @returns {RiskLevel}
 */
export function computeParasiteRiskLevel(
  avgTempC,
  totalRainMm,
  _maxHourlyRainMm,
  elevationM,
  parasiteId
) {
  const id = PARASITE_IDS.has(parasiteId) ? parasiteId : "roundworms";

  if (!Number.isFinite(avgTempC) || !Number.isFinite(totalRainMm)) {
    return "low";
  }

  const tEff = avgTempC;
  if (id === "average") {
    const avgScore =
      BASE_PARASITE_IDS
        .map((p) => {
          const base = simpleParasiteLevel(tEff, totalRainMm, p);
          const adjusted = adjustedLevel(base, p, elevationM);
          return levelToScore(adjusted);
        })
        .reduce((a, b) => a + b, 0) / BASE_PARASITE_IDS.length;
    return scoreToLevel(avgScore);
  }

  const baseLevel = simpleParasiteLevel(tEff, totalRainMm, id);
  return adjustedLevel(baseLevel, id, elevationM);
}

/**
 * Short notes for the side panel (still transparent, much lighter than a score model).
 */
export function getParasiteRiskBreakdown(
  avgTempC,
  totalRainMm,
  maxHourlyRainMm,
  elevationM,
  parasiteId
) {
  const id = PARASITE_IDS.has(parasiteId) ? parasiteId : "roundworms";

  if (!Number.isFinite(avgTempC) || !Number.isFinite(totalRainMm)) {
    return {
      level: /** @type {RiskLevel} */ ("low"),
      score: 0,
      effectiveTempC: avgTempC,
      rawAvgTempC: avgTempC,
      elevationM: Number.isFinite(elevationM) ? elevationM : null,
      parasiteId: id,
      notes: ["Missing weather data — risk set to low."],
      references: ["Simple threshold bands with a direct elevation modifier by parasite."],
    };
  }

  const tEff = avgTempC;
  const componentLevels =
    id === "average"
      ? Object.fromEntries(
          BASE_PARASITE_IDS.map((p) => {
            const base = simpleParasiteLevel(tEff, totalRainMm, p);
            return [p, adjustedLevel(base, p, elevationM)];
          })
        )
      : null;

  const avgScore =
    componentLevels
      ? Object.values(componentLevels).reduce((sum, lv) => sum + levelToScore(lv), 0) /
        BASE_PARASITE_IDS.length
      : null;

  const level = componentLevels
    ? scoreToLevel(avgScore)
    : adjustedLevel(simpleParasiteLevel(tEff, totalRainMm, id), id, elevationM);
  const score = componentLevels ? avgScore : levelToScore(level);

  const el = Number.isFinite(elevationM) ? elevationM : null;
  const rules = THRESHOLDS[id];
  const modifier = id === "average" ? null : elevationModifier(id, elevationM);
  const notes = [
    `Temperature ${avgTempC.toFixed(1)} °C${
      el != null ? `, elevation ${el} m` : ""
    }.`,
    `Rainfall ${totalRainMm.toFixed(1)} mm${
      Number.isFinite(maxHourlyRainMm) ? `; max hourly ${maxHourlyRainMm.toFixed(1)} mm` : ""
    }.`,
  ];
  if (modifier != null && modifier !== 0) {
    notes.push(`Direct elevation modifier applied for ${id}: ${modifier > 0 ? "+" : ""}${modifier.toFixed(2)} score.`);
  } else if (modifier === 0 && id !== "average") {
    notes.push(`Direct elevation modifier for ${id}: 0.00 score.`);
  }
  if (componentLevels) {
    notes.push(
      `Average mode combines elevation-adjusted levels for roundworms, lungworms, flukes, coccidia, and lice equally.`
    );
  }

  return {
    level,
    score,
    effectiveTempC: tEff,
    rawAvgTempC: avgTempC,
    elevationM: el,
    parasiteId: id,
    componentLevels,
    notes,
    references: [
      "Simple threshold bands per parasite; separate direct elevation modifier by parasite.",
    ],
  };
}

/**
 * @deprecated Use computeParasiteRiskLevel
 */
export function computeRiskLevel(avgTemp, totalRain) {
  return computeParasiteRiskLevel(avgTemp, totalRain, null, null, "roundworms");
}
