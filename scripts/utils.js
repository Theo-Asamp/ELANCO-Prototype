export function computeRiskLevel(avgTemp, totalRain) {
  if (!Number.isFinite(avgTemp) || !Number.isFinite(totalRain)) return "low";

  // Simple rule-based thresholds for the prototype
  if (avgTemp >= 10 && avgTemp <= 20 && totalRain >= 20 && totalRain <= 120) {
    return "high";
  }

  if (avgTemp >= 5 && avgTemp <= 25 && totalRain >= 10 && totalRain <= 150) {
    return "medium";
  }

  return "low";
}

