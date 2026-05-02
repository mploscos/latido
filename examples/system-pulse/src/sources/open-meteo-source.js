import { fallbackWeather } from "./fallback-simulator.js"

export const weatherLocations = [
  { id: "madrid", label: "Madrid", latitude: 40.4168, longitude: -3.7038, baseTemperature: 18, seed: 0.2 },
  { id: "london", label: "London", latitude: 51.5072, longitude: -0.1276, baseTemperature: 12, seed: 1.4 },
  { id: "new-york", label: "New York", latitude: 40.7128, longitude: -74.006, baseTemperature: 14, seed: 2.1 },
  { id: "tokyo", label: "Tokyo", latitude: 35.6762, longitude: 139.6503, baseTemperature: 19, seed: 3.2 }
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
          "weather.pressure": readNumber(current.pressure_msl),
          "weather.precipitation": readNumber(current.precipitation)
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
      values: {
        "weather.temperature": fallback.temperature,
        "weather.wind": fallback.wind,
        "weather.pressure": fallback.pressure,
        "weather.precipitation": fallback.precipitation
      }
    })
  }

  function takeResetFlag() {
    const shouldReset = resetOnNextEmit
    resetOnNextEmit = false
    return shouldReset
  }
}

function openMeteoUrl(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,wind_speed_10m,pressure_msl,precipitation"
  })
  return `https://api.open-meteo.com/v1/forecast?${params}`
}

function readNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
