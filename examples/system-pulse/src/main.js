import { createLatido } from "@latido/core"
import { defineLatidoElements, dom } from "@latido/dom"
import { createSystemPulseSources, weatherLocations } from "./sources/system-pulse-sources.js"
import { bindSystemSignals } from "./view/bind-system-signals.js"
import { createSystemPulseView } from "./view/system-pulse-view.js"
import "./styles.css"

defineLatidoElements()

const view = createSystemPulseView({ weatherLocations })
const latido = createLatido()
  .use(dom())
  .use(createSystemPulseSources({ onUpdate: snapshot => view.updateSources(snapshot) }))

view.connect(latido)

bindSystemSignals(latido, view, [
  { system: "market", source: "market.delta", target: "tone", pipe: signal => signal.normalize(-4, 4).clamp(0, 1).smooth(0.12) },
  { system: "market", source: "market.volume", target: "energy", pipe: signal => signal.normalize(0.2, 1.8).clamp(0, 1).smooth(0.1) },
  { system: "market", source: "market.volume", target: "flow", pipe: signal => signal.normalize(0.2, 1.8).clamp(0, 1).smooth(0.1) },
  { system: "market", source: "market.volatility", target: "irregularity", pipe: signal => signal.normalize(0, 2.8).clamp(0, 1).smooth(0.18) },
  { system: "market", source: "market.beat", target: "beat", pipe: signal => signal.pulse(180).decay(0.12) },
  { system: "market", source: "market.healthScore", target: "health-score", pipe: signal => signal.smooth(0.04) },
  { system: "market", source: "market.healthIntensity", target: "health-intensity", pipe: signal => signal.smooth(0.18) },

  { system: "weather", source: "weather.temperature", target: "tone", pipe: signal => signal.normalize(-4, 36).clamp(0, 1).smooth(0.08) },
  { system: "weather", source: "weather.wind", target: "energy", pipe: signal => signal.normalize(0, 48).clamp(0, 1).smooth(0.1) },
  { system: "weather", source: "weather.wind", target: "flow", pipe: signal => signal.normalize(0, 48).clamp(0, 1).smooth(0.1) },
  { system: "weather", source: "weather.pressure", target: "pressure", pipe: signal => signal.normalize(970, 1040).clamp(0, 1).smooth(0.05) },
  { system: "weather", source: "weather.pressure", target: "irregularity", pipe: signal => signal.normalize(970, 1040).map(value => Math.abs(value - 0.5) * 0.8).smooth(0.05) },
  { system: "weather", source: "weather.precipitation", target: "beat", pipe: signal => signal.threshold(0.2).pulse(240).decay(0.1) },
  { system: "weather", source: "weather.healthScore", target: "health-score", pipe: signal => signal.smooth(0.04) },
  { system: "weather", source: "weather.healthIntensity", target: "health-intensity", pipe: signal => signal.smooth(0.18) }
])

latido.start()
