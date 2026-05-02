import { createMarketSource } from "./market-source.js"
import { createOpenMeteoSource, weatherLocations } from "./open-meteo-source.js"
import { deriveSystemHealth } from "../state/system-health.js"

const sourceNames = [
  "market.price",
  "market.delta",
  "market.volume",
  "market.volatility",
  "market.beat",
  "market.healthScore",
  "market.healthTrend",
  "market.healthIntensity",
  "weather.temperature",
  "weather.wind",
  "weather.pressure",
  "weather.precipitation",
  "weather.healthScore",
  "weather.healthTrend",
  "weather.healthIntensity"
]
const maxHistorySamples = 60
const maxHistoryAge = 30 * 60 * 1000

export { weatherLocations }

export function createSystemPulseSources(options = {}) {
  return latido => {
    const values = new Map(sourceNames.map(name => [name, 0]))
    const state = {
      market: createSystemState("Market", "starting"),
      weather: createSystemState("Madrid", "starting")
    }
    const onUpdate = options.onUpdate ?? (() => {})

    for (const name of sourceNames) {
      latido.source(name, () => values.get(name) ?? 0)
    }

    const weather = createOpenMeteoSource({
      location: options.location,
      onData: data => updateSystem("weather", data)
    })
    const market = createMarketSource({
      experimentalLiveMarket: options.experimentalLiveMarket ?? true,
      onData: data => updateSystem("market", data)
    })

    latido.control("setWeatherLocation", locationId => weather.setLocation(locationId))
    latido.control("systemPulseDebug", () => structuredClone(state))
    latido.control("stopSystemPulseSources", () => {
      weather.stop()
      market.stop()
    })

    weather.start()
    market.start()

    function updateSystem(system, data) {
      const timestamp = data.timestamp ?? Date.now()

      for (const [name, value] of Object.entries(data.values)) {
        values.set(name, value)
      }

      const snapshot = state[system]
      snapshot.history = data.resetHistory ? [] : pruneHistory(snapshot.history, timestamp)
      snapshot.label = data.location ?? snapshot.label
      snapshot.locationId = data.locationId ?? snapshot.locationId
      snapshot.status = data.status
      snapshot.provider = data.provider
      snapshot.source = data.source ?? snapshot.source
      snapshot.values = { ...snapshot.values, ...data.values }
      snapshot.health = deriveSystemHealth(system, snapshot.values, snapshot.history)
      values.set(`${system}.healthScore`, snapshot.health.score)
      values.set(`${system}.healthTrend`, snapshot.health.trendCode)
      values.set(`${system}.healthIntensity`, snapshot.health.intensity)
      snapshot.history = appendHistory(snapshot.history, timestamp, snapshot.values, snapshot.health)
      onUpdate(structuredClone(state))
    }
  }
}

function appendHistory(history, timestamp, values, health) {
  const entry = {
    timestamp,
    values: { ...values },
    healthScore: health.score,
    healthState: health.state,
    trend: health.trend,
    stateDuration: health.stateDuration,
    health: { ...health }
  }

  return pruneHistory([...history, entry], timestamp)
}

function pruneHistory(history, now) {
  return history
    .filter(item => now - item.timestamp <= maxHistoryAge)
    .slice(-maxHistorySamples)
}

function createSystemState(label, status) {
  return {
    label,
    locationId: "",
    status,
    provider: "",
    source: {
      label: "",
      url: "",
      external: false
    },
    values: {},
    health: {
      state: "unknown",
      score: 0.5,
      trend: "stable",
      trendCode: 0.5,
      trendDelta: 0,
      reason: "Waiting for data",
      intensity: 0.2,
      baseState: "unknown",
      baseScore: 0.5
    },
    history: []
  }
}
