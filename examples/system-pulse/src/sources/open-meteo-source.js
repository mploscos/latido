import { fallbackWeather } from "./fallback-simulator.js"

export const weatherLocations = [
  { id: "madrid", label: "Madrid", latitude: 40.4168, longitude: -3.7038, baseTemperature: 18, seed: 0.2 },
  { id: "london", label: "London", latitude: 51.5072, longitude: -0.1276, baseTemperature: 12, seed: 1.4 },
  { id: "new-york", label: "New York", latitude: 40.7128, longitude: -74.006, baseTemperature: 14, seed: 2.1 },
  { id: "tokyo", label: "Tokyo", latitude: 35.6762, longitude: 139.6503, baseTemperature: 19, seed: 3.2 },
  { id: "bergen", label: "Bergen", latitude: 60.3913, longitude: 5.3221, baseTemperature: 8, seed: 4.4 },
  { id: "reykjavik", label: "Reykjavik", latitude: 64.1466, longitude: -21.9426, baseTemperature: 5, seed: 5.3 },
  { id: "tromso", label: "Tromso", latitude: 69.6492, longitude: 18.9553, baseTemperature: 1, seed: 6.1 },
  { id: "seattle", label: "Seattle", latitude: 47.6062, longitude: -122.3321, baseTemperature: 11, seed: 7.2 },
  { id: "glasgow", label: "Glasgow", latitude: 55.8642, longitude: -4.2518, baseTemperature: 9, seed: 8.4 },
  { id: "singapore", label: "Singapore", latitude: 1.3521, longitude: 103.8198, baseTemperature: 28, seed: 9.6 },
  { id: "ushuaia", label: "Ushuaia", latitude: -54.8019, longitude: -68.303, baseTemperature: 3, seed: 10.8 },
  { id: "queenstown", label: "Queenstown", latitude: -45.0312, longitude: 168.6626, baseTemperature: 7, seed: 11.7 },
  {
    id: "scenario-rain",
    label: "Scenario: heavy rain",
    scenario: true,
    baseTemperature: 11,
    seed: 12.4,
    values: {
      temperature: 11.8,
      wind: 18,
      windDirection: 240,
      windGusts: 42,
      pressure: 998,
      precipitation: 7.6,
      rain: 6.8,
      showers: 1.5,
      snowfall: 0,
      cloudCover: 98,
      weatherCode: 63
    }
  },
  {
    id: "scenario-snow",
    label: "Scenario: snowfall",
    scenario: true,
    baseTemperature: -2,
    seed: 13.5,
    values: {
      temperature: -2.4,
      wind: 12,
      windDirection: 20,
      windGusts: 34,
      pressure: 1005,
      precipitation: 4.2,
      rain: 0,
      showers: 0.2,
      snowfall: 3.4,
      cloudCover: 100,
      weatherCode: 75
    }
  },
  {
    id: "scenario-storm",
    label: "Scenario: storm",
    scenario: true,
    baseTemperature: 20,
    seed: 14.6,
    values: {
      temperature: 20.4,
      wind: 34,
      windDirection: 285,
      windGusts: 72,
      pressure: 986,
      precipitation: 11.2,
      rain: 8.5,
      showers: 4.8,
      snowfall: 0,
      cloudCover: 100,
      weatherCode: 95
    }
  }
]

export function createOpenMeteoSource(options = {}) {
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis)
  const interval = options.interval ?? 60000
  const onData = options.onData ?? (() => {})
  let location = weatherLocations.find(item => item.id === options.location) ?? weatherLocations[0]
  let timer = null
  let requestId = 0
  let resetOnNextEmit = false

  return {
    start() {
      refresh()
      timer = window.setInterval(refresh, interval)
    },
    stop() {
      if (timer) window.clearInterval(timer)
    },
    setLocation(locationId) {
      const nextLocation = weatherLocations.find(item => item.id === locationId) ?? location
      if (nextLocation.id === location.id) return

      location = nextLocation
      resetOnNextEmit = true
      refresh()
    }
  }

  async function refresh() {
    const currentRequest = ++requestId
    const requestLocation = location

    if (!fetcher) {
      emitFallback(requestLocation)
      return
    }

    if (requestLocation.scenario) {
      emitScenario(requestLocation)
      return
    }

    try {
      const response = await fetcher(openMeteoUrl(requestLocation))
      if (currentRequest !== requestId || requestLocation.id !== location.id) return
      if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`)
      const payload = await response.json()
      if (currentRequest !== requestId || requestLocation.id !== location.id) return
      const current = payload.current ?? {}
      onData({
        status: "live via Open-Meteo",
        provider: "Open-Meteo",
        location: requestLocation.label,
        locationId: requestLocation.id,
        resetHistory: takeResetFlag(),
        source: {
          label: "Open-Meteo current weather",
          url: openMeteoUrl(requestLocation),
          external: true
        },
        values: {
          "weather.temperature": readNumber(current.temperature_2m),
          "weather.wind": readNumber(current.wind_speed_10m),
          "weather.windDirection": readNumber(current.wind_direction_10m),
          "weather.windGusts": readNumber(current.wind_gusts_10m),
          "weather.pressure": readNumber(current.pressure_msl),
          "weather.precipitation": readNumber(current.precipitation),
          "weather.rain": readNumber(current.rain),
          "weather.showers": readNumber(current.showers),
          "weather.snowfall": readNumber(current.snowfall),
          "weather.cloudCover": readNumber(current.cloud_cover),
          "weather.weatherCode": readNumber(current.weather_code)
        }
      })
    } catch {
      if (currentRequest !== requestId || requestLocation.id !== location.id) return
      emitFallback(requestLocation)
    }
  }

  function emitFallback(activeLocation) {
    if (activeLocation.id !== location.id) return

    const fallback = fallbackWeather(activeLocation)
    onData({
      status: "fallback",
      provider: "local fallback",
      location: activeLocation.label,
      locationId: activeLocation.id,
      resetHistory: takeResetFlag(),
      source: {
        label: "Deterministic local fallback",
        url: "",
        external: false
      },
      values: weatherValues(fallback)
    })
  }

  function emitScenario(activeLocation) {
    if (activeLocation.id !== location.id) return

    const scenario = scenarioWeather(activeLocation)
    onData({
      status: "scenario",
      provider: "local weather scenario",
      location: activeLocation.label,
      locationId: activeLocation.id,
      resetHistory: takeResetFlag(),
      source: {
        label: "Deterministic local scenario",
        url: "",
        external: false
      },
      values: weatherValues(scenario)
    })
  }

  function takeResetFlag() {
    const shouldReset = resetOnNextEmit
    resetOnNextEmit = false
    return shouldReset
  }
}

function scenarioWeather(location, now = Date.now()) {
  const phase = Math.sin(now * 0.001 + location.seed)
  const gustPulse = Math.max(0, Math.sin(now * 0.0023 + location.seed * 2))
  const values = location.values

  return {
    ...values,
    wind: Math.max(0, values.wind + phase * 2.4),
    windGusts: Math.max(values.wind, values.windGusts + gustPulse * 7),
    precipitation: Math.max(0, values.precipitation + phase * 0.7),
    rain: Math.max(0, values.rain + phase * 0.5),
    showers: Math.max(0, values.showers + gustPulse * 0.9),
    snowfall: values.snowfall > 0 ? Math.max(0, values.snowfall + phase * 0.25) : 0,
    pressure: values.pressure + phase * 1.2
  }
}

function weatherValues(weather) {
  return {
    "weather.temperature": weather.temperature,
    "weather.wind": weather.wind,
    "weather.windDirection": weather.windDirection,
    "weather.windGusts": weather.windGusts,
    "weather.pressure": weather.pressure,
    "weather.precipitation": weather.precipitation,
    "weather.rain": weather.rain,
    "weather.showers": weather.showers,
    "weather.snowfall": weather.snowfall,
    "weather.cloudCover": weather.cloudCover,
    "weather.weatherCode": weather.weatherCode
  }
}

function openMeteoUrl(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation,rain,showers,snowfall,cloud_cover,weather_code"
  })
  return `https://api.open-meteo.com/v1/forecast?${params}`
}

function readNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
