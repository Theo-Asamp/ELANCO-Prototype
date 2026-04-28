import { jest } from "@jest/globals";
import { getOpenMeteoTemperatureAndRainfall } from "../scripts/api.js";

global.fetch = jest.fn();
console.error = jest.fn();

describe("Shameer - API and Weather Data Testing", () => {
  beforeEach(() => {
    fetch.mockClear();
    console.error.mockClear();
  });

  test("API01 - Weather Fetch", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latitude: 54.5,
        longitude: -1.5,
        elevation: 120,
        timezone: "GMT",
        hourly: {
          time: ["2026-01-01T00:00"],
          temperature_2m: [12],
          precipitation: [5]
        }
      })
    });

    const data = await getOpenMeteoTemperatureAndRainfall(54.5, -1.5);

    expect(data).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("API02 - Temperature Display", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latitude: 54.5,
        longitude: -1.5,
        elevation: 120,
        timezone: "GMT",
        hourly: {
          time: ["2026-01-01T00:00"],
          temperature_2m: [15],
          precipitation: [2]
        }
      })
    });

    const data = await getOpenMeteoTemperatureAndRainfall(54.5, -1.5);

    expect(data.temperature_2m[0]).toBe(15);
  });

  test("API03 - Rainfall Display", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latitude: 54.5,
        longitude: -1.5,
        elevation: 120,
        timezone: "GMT",
        hourly: {
          time: ["2026-01-01T00:00"],
          temperature_2m: [15],
          precipitation: [8]
        }
      })
    });

    const data = await getOpenMeteoTemperatureAndRainfall(54.5, -1.5);

    expect(data.precipitation[0]).toBe(8);
  });

  test("API04 - Elevation Display", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latitude: 54.5,
        longitude: -1.5,
        elevation: 250,
        timezone: "GMT",
        hourly: {
          time: ["2026-01-01T00:00"],
          temperature_2m: [15],
          precipitation: [8]
        }
      })
    });

    const data = await getOpenMeteoTemperatureAndRainfall(54.5, -1.5);

    expect(data.elevation).toBe(250);
  });

  test("API05 - Different Farms", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          latitude: 54.5,
          longitude: -1.5,
          elevation: 120,
          timezone: "GMT",
          hourly: {
            time: ["2026-01-01T00:00"],
            temperature_2m: [10],
            precipitation: [4]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          latitude: 55.2,
          longitude: -2.1,
          elevation: 300,
          timezone: "GMT",
          hourly: {
            time: ["2026-01-01T00:00"],
            temperature_2m: [18],
            precipitation: [1]
          }
        })
      });

    const farm1 = await getOpenMeteoTemperatureAndRainfall(54.5, -1.5);
    const farm2 = await getOpenMeteoTemperatureAndRainfall(55.2, -2.1);

    expect(farm1.temperature_2m[0]).not.toBe(farm2.temperature_2m[0]);
    expect(farm1.elevation).not.toBe(farm2.elevation);
  });

  test("API06 - Failed Request", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error"
    });

    await expect(
      getOpenMeteoTemperatureAndRainfall(54.5, -1.5)
    ).rejects.toThrow();
  });
});