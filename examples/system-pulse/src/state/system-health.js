import { createHealthInterpreter } from "@latido/core"
import { deriveMarketBase, reasonMarketHealth } from "./market-health.js"
import { deriveWeatherBase, reasonWeatherHealth } from "./weather-health.js"

/**
 * Interprets current system values and history into a narrative health state.
 *
 * Market and weather modules keep the domain rules. Latido core handles the
 * reusable temporal interpretation layer.
 */
const interpretSystemHealth = createHealthInterpreter({
  deriveBase(system, currentValues, history) {
    if (system === "market") return deriveMarketBase(currentValues, history)
    if (system === "weather") return deriveWeatherBase(currentValues, history)
    return unknownBase()
  },
  reasonFor(state, baseHealth, temporal) {
    if (baseHealth.system === "market") return reasonMarketHealth(state, baseHealth, temporal)
    if (baseHealth.system === "weather") return reasonWeatherHealth(state, baseHealth, temporal)
    if (state === "stable") return "Stable conditions"
    return "Waiting for data"
  }
})

/**
 * Interprets current system values and history into a narrative health state.
 *
 * @param {string} system System namespace.
 * @param {object} currentValues Current source values.
 * @param {Array<object>} [history=[]] Bounded system health history.
 * @returns {object}
 */
export function deriveSystemHealth(system, currentValues, history = []) {
  return interpretSystemHealth(system, currentValues, history)
}

function unknownBase() {
  return {
    system: "unknown",
    baseScore: 0.5,
    baseState: "normal",
    domainRisks: [],
    metrics: {}
  }
}
