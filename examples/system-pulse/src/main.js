import { createLatido, signalPipe } from "@latido/core"
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
  { system: "market", source: "market.delta", target: "tone", pipe: signalPipe.normalized(-4, 4, 0.12) },
  { system: "market", source: "market.volume", target: "energy", pipe: signalPipe.normalized(0.15, 1.45, 0.1) },
  { system: "market", source: "market.volume", target: "flow", pipe: signalPipe.normalized(0.2, 1.35, 0.08) },
  { system: "market", source: "market.volatility", target: "irregularity", pipe: signalPipe.normalized(0, 2.8, 0.18) },
  { system: "market", source: "market.beat", target: "beat", pipe: signal => signal.pulse(180).decay(0.12) },
  { system: "market", source: "market.volume", target: "latido-core-wind-x", pipe: signalPipe.zero() },
  { system: "market", source: "market.volume", target: "latido-core-wind-y", pipe: signalPipe.zero() },
  { system: "market", source: "market.volume", target: "latido-core-wind-force", pipe: signalPipe.zero() },
  { system: "market", source: "market.volume", target: "latido-core-wind-angle", pipe: signalPipe.zero() },
  { system: "market", source: "market.healthScore", target: "health-score", pipe: signalPipe.smooth(0.04) },
  { system: "market", source: "market.healthIntensity", target: "health-intensity", pipe: signalPipe.smooth(0.18) },

  { system: "weather", source: "weather.temperature", target: "tone", pipe: signalPipe.normalized(-4, 36, 0.08) },
  { system: "weather", source: "weather.visualEnergy", target: "energy", pipe: signalPipe.clamped(0.1) },
  { system: "weather", source: "weather.visualFlow", target: "flow", pipe: signalPipe.clamped(0.08) },
  { system: "weather", source: "weather.pressure", target: "pressure", pipe: signalPipe.normalized(970, 1040, 0.05) },
  { system: "weather", source: "weather.visualIrregularity", target: "irregularity", pipe: signalPipe.clamped(0.08) },
  { system: "weather", source: "weather.visualBeat", target: "beat", pipe: signalPipe.beat(0.2, 280, 0.1) },
  { system: "weather", source: "weather.precipitation", target: "precipitation", pipe: signalPipe.normalized(0, 8, 0.12) },
  { system: "weather", source: "weather.rain", target: "rain", pipe: signalPipe.normalized(0, 8, 0.12) },
  { system: "weather", source: "weather.showers", target: "showers", pipe: signalPipe.normalized(0, 5, 0.12) },
  { system: "weather", source: "weather.snowfall", target: "snowfall", pipe: signalPipe.normalized(0, 4, 0.12) },
  { system: "weather", source: "weather.visualWindX", target: "latido-core-wind-x", pipe: signalPipe.smooth(0.1) },
  { system: "weather", source: "weather.visualWindY", target: "latido-core-wind-y", pipe: signalPipe.smooth(0.1) },
  { system: "weather", source: "weather.visualWindAngle", target: "latido-core-wind-angle", pipe: signalPipe.smooth(0.1) },
  { system: "weather", source: "weather.visualFlow", target: "latido-core-wind-force", pipe: signalPipe.clamped(0.1) },
  { system: "weather", source: "weather.healthScore", target: "health-score", pipe: signalPipe.smooth(0.04) },
  { system: "weather", source: "weather.healthIntensity", target: "health-intensity", pipe: signalPipe.smooth(0.18) }
])

latido.start()
