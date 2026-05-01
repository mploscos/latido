import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"
import { audio } from "@latido/audio"
import { events } from "@latido/events"
import "./adaptive-hmi.css"

const root = document.documentElement
const body = document.body
const audioElement = document.querySelector("audio")
const sourceName = document.querySelector(".source-name")
const sourceMode = document.querySelector(".source-mode")
const metricEnergyLabel = document.querySelector(".metric-energy-label")
const metricFlowLabel = document.querySelector(".metric-flow-label")
const metricVolatilityLabel = document.querySelector(".metric-volatility-label")
const channelPrimaryLabel = document.querySelector(".channel-primary-label")
const channelSecondaryLabel = document.querySelector(".channel-secondary-label")
const channelTertiaryLabel = document.querySelector(".channel-tertiary-label")
const flowValue = document.querySelector(".flow-value")
const primaryValue = document.querySelector(".channel-primary-value")
const secondaryValue = document.querySelector(".channel-secondary-value")
const tertiaryValue = document.querySelector(".channel-tertiary-value")
const canvas = document.querySelector(".wave-canvas")
const ctx = canvas.getContext("2d")

const adapters = createAdapters()
const hmi = {
  energy: 0,
  pulse: 0,
  flow: 0,
  volatility: 0,
  phase: 0,
  primary: 0,
  secondary: 0,
  tertiary: 0
}
const traces = Array.from({ length: 3 }, () => [])

const latido = createLatido()
  .use(dom())
  .use(audio({ element: audioElement }))
  .use(events())
  .adapt("hmi", {
    initial: "weather",
    adapters
  })

bindHmi(latido)
latido.start()

for (const tab of document.querySelectorAll(".source-tab")) {
  tab.addEventListener("click", () => setSource(tab.dataset.source))
}

draw()

function bindHmi(engine) {
  engine.signal("hmi.energy")
    .smooth(0.18)
    .bindCSSVar(root, "--energy")
    .bind(value => {
      hmi.energy = value
    })

  engine.signal("hmi.pulse")
    .decay(0.16)
    .bindCSSVar(root, "--pulse")
    .bindClass(body, "is-pulsing", value => value > 0.35)
    .bind(value => {
      hmi.pulse = value
    })

  engine.signal("hmi.flow")
    .smooth(0.12)
    .bindCSSVar(root, "--flow")
    .bind(value => {
      hmi.flow = value
      flowValue.textContent = value.toFixed(2)
    })

  engine.signal("hmi.volatility")
    .smooth(0.16)
    .bindCSSVar(root, "--volatility")
    .bind(value => {
      hmi.volatility = value
    })

  engine.signal("hmi.phase")
    .bindCSSVar(root, "--phase")
    .bind(value => {
      hmi.phase = value
    })

  engine.signal("hmi.primary").bind(value => {
    hmi.primary = value
    primaryValue.textContent = value.toFixed(2)
  })

  engine.signal("hmi.secondary").bind(value => {
    hmi.secondary = value
    secondaryValue.textContent = value.toFixed(2)
  })

  engine.signal("hmi.tertiary").bind(value => {
    hmi.tertiary = value
    tertiaryValue.textContent = value.toFixed(2)
  })
}

async function setSource(name) {
  if (!adapters[name]) return
  latido.useAdapter("hmi", name)
  sourceName.textContent = adapters[name].label
  sourceMode.textContent = adapters[name].mode
  setSignalLabels(adapters[name].labels)

  for (const tab of document.querySelectorAll(".source-tab")) {
    const active = tab.dataset.source === name
    tab.classList.toggle("is-active", active)
    tab.setAttribute("aria-selected", String(active))
  }

  if (name === "audio") {
    await playAudio()
  } else {
    pauseAudio()
  }
}

function setSignalLabels(labels) {
  metricEnergyLabel.textContent = labels.energy
  metricFlowLabel.textContent = labels.flow
  metricVolatilityLabel.textContent = labels.volatility
  channelPrimaryLabel.textContent = labels.primary
  channelSecondaryLabel.textContent = labels.secondary
  channelTertiaryLabel.textContent = labels.tertiary
}

async function playAudio() {
  try {
    await latido.play()
  } catch (error) {
    setSource("weather")
  }
}

function pauseAudio() {
  latido.pause()
}

function createAdapters() {
  const marketState = {
    previousPrice: null,
    volatility: 0
  }

  return {
    audio: {
      label: "Audio",
      mode: "Spectral onset",
      labels: {
        energy: "RMS energy",
        flow: "Spectral flux",
        volatility: "Treble level",
        primary: "Bass",
        secondary: "Mid",
        tertiary: "Treble"
      },
      read(context) {
        const values = context.latido.audioDebug?.()?.values ?? {}
        return {
          energy: values.energy ?? wave(context, 0.17, 0.5, 0.12),
          pulse: values.beat ?? 0,
          flow: values.flux ?? 0,
          volatility: values.treble ?? 0,
          phase: context.time * 0.00008,
          primary: values.bass ?? 0,
          secondary: values.mid ?? 0,
          tertiary: values.treble ?? 0
        }
      }
    },
    weather: {
      label: "Weather",
      mode: "Wind, pressure, storm cells",
      labels: {
        energy: "Thermal intensity",
        flow: "Wind flow",
        volatility: "Gust volatility",
        primary: "Wind",
        secondary: "Pressure",
        tertiary: "Gust volatility"
      },
      read(context) {
        const wind = wave(context, 0.08, 0.52, 0.24)
        const gust = pulseTrain(context, 2600, 0.28)
        const pressure = wave(context, 0.018, 0.5, 0.45)
        const storm = wave(context, 0.032, 0.45, 0.68) * gust

        return {
          energy: wind * 0.68 + storm * 0.32,
          pulse: storm > 0.48 ? 1 : 0,
          flow: wind,
          volatility: gust,
          phase: context.time * 0.000045,
          primary: wind,
          secondary: pressure,
          tertiary: gust
        }
      }
    },
    biology: {
      label: "Biology",
      mode: "Catabolism: glucose + O2 -> ATP + H2O + CO2",
      labels: {
        energy: "ATP yield",
        flow: "O2 uptake",
        volatility: "Metabolic stress",
        primary: "Glucose",
        secondary: "Oxygen",
        tertiary: "Metabolic stress"
      },
      read(context) {
        const glucose = wave(context, 0.028, 0.62, 0.22)
        const oxygen = wave(context, 0.041, 0.68, 0.18)
        const enzymePulse = pulseTrain(context, 1380, 0.14)
        const substrateBalance = glucose * oxygen
        const atp = clamp01(substrateBalance * 1.35)
        const stress = clamp01(Math.abs(glucose - oxygen) * 1.8 + enzymePulse * 0.22)

        return {
          energy: atp,
          pulse: stress > 0.42 ? 1 : 0,
          flow: oxygen,
          volatility: stress,
          phase: context.time * 0.00011,
          primary: glucose,
          secondary: oxygen,
          tertiary: stress
        }
      }
    },
    aero: {
      label: "Aeronautics",
      mode: "AoA, vibration, engine load",
      labels: {
        energy: "Engine load",
        flow: "Thrust flow",
        volatility: "Vibration",
        primary: "Engine",
        secondary: "Angle of attack",
        tertiary: "Vibration"
      },
      read(context) {
        const engine = wave(context, 0.12, 0.58, 0.18)
        const vibration = wave(context, 0.74, 0.5, 0.18)
        const angle = wave(context, 0.034, 0.44, 0.3)
        const alert = angle > 0.72 && vibration > 0.55 ? 1 : 0

        return {
          energy: engine * 0.48 + vibration * 0.34 + angle * 0.18,
          pulse: alert,
          flow: engine,
          volatility: vibration,
          phase: context.time * 0.00016,
          primary: engine,
          secondary: angle,
          tertiary: vibration
        }
      }
    },
    markets: {
      label: "Markets",
      mode: "Price, volume, return volatility",
      labels: {
        energy: "Market activity",
        flow: "Volume flow",
        volatility: "Return volatility",
        primary: "Price",
        secondary: "Volume",
        tertiary: "Volatility"
      },
      read(context) {
        const trend = wave(context, 0.012, 0.5, 0.22)
        const cycle = wave(context, 0.09, 0.5, 0.18)
        const event = pulseTrain(context, 4200, 0.08)
        const eventDirection = wave(context, 0.006, 0.5, 0.5) > 0.5 ? 1 : -1
        const price = clamp01(trend * 0.72 + cycle * 0.28 + event * eventDirection * 0.08)
        const previousPrice = marketState.previousPrice ?? price
        const priceReturn = Math.abs(price - previousPrice)

        marketState.previousPrice = price
        marketState.volatility = clamp01(marketState.volatility * 0.88 + priceReturn * 7.5 + event * 0.1)

        const volatility = marketState.volatility
        const volume = clamp01(wave(context, 0.052, 0.42, 0.2) + volatility * 0.42 + event * 0.18)
        const activity = clamp01(volume * 0.45 + volatility * 0.35 + Math.abs(price - 0.5) * 0.4)

        return {
          energy: activity,
          pulse: volatility > 0.58 ? 1 : 0,
          flow: volume,
          volatility,
          phase: context.time * 0.00009,
          primary: price,
          secondary: volume,
          tertiary: volatility
        }
      }
    },
    events: {
      label: "Events",
      mode: "Move the pointer and click to inject pulses",
      labels: {
        energy: "Pointer displacement",
        flow: "Horizontal position",
        volatility: "Click impulse",
        primary: "Pointer X",
        secondary: "Pointer Y",
        tertiary: "Click pulse"
      },
      read(context) {
        const x = context.latido.values.get("event.pointer.progressX") ?? 0
        const y = context.latido.values.get("event.pointer.progressY") ?? 0
        const click = context.latido.values.get("event.click.pulse") ?? 0
        const movement = Math.abs(x - 0.5) + Math.abs(y - 0.5)

        return {
          energy: clamp01(movement),
          pulse: click || movement > 0.62 ? 1 : 0,
          flow: x,
          volatility: click,
          phase: y,
          primary: x,
          secondary: y,
          tertiary: click
        }
      }
    }
  }
}

function draw() {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.floor(rect.width))
  const height = Math.max(1, Math.floor(rect.height))

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = "rgba(12, 15, 20, 0.48)"
  ctx.fillRect(0, 0, width, height)

  pushTrace(0, hmi.primary, width)
  pushTrace(1, hmi.secondary, width)
  pushTrace(2, hmi.tertiary, width)

  drawTrace(traces[0], width, height, "#ef476f", 0.82)
  drawTrace(traces[1], width, height, "#06d6a0", 0.68)
  drawTrace(traces[2], width, height, "#ffd166", 0.56)
  drawGrid(width, height)

  requestAnimationFrame(draw)
}

function pushTrace(index, value, width) {
  traces[index].push(value)
  while (traces[index].length > width) traces[index].shift()
}

function drawTrace(trace, width, height, color, alpha) {
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = 2
  ctx.beginPath()

  for (let index = 0; index < trace.length; index += 1) {
    const x = width - trace.length + index
    const y = height - trace[index] * height
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }

  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawGrid(width, height) {
  ctx.strokeStyle = "rgba(238, 242, 244, 0.08)"
  ctx.lineWidth = 1

  for (let x = 0; x < width; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  for (let y = 0; y < height; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

function wave(context, hz, center = 0.5, amplitude = 0.5) {
  return center + Math.sin(context.time * 0.001 * Math.PI * 2 * hz) * amplitude
}

function pulseTrain(context, interval, width) {
  const phase = (context.time % interval) / interval
  return Math.exp(-Math.pow(phase / width, 2) * 12)
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}
