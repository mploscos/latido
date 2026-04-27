import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"
import { audio } from "@latido/audio"
import "./styles.css"

const button = document.querySelector(".beat-button")
const debugToggle = document.querySelector(".debug-toggle")
const debugPanel = document.querySelector(".audio-debug")
const debugCanvas = document.querySelector(".audio-debug-canvas")
const audioElement = document.querySelector("audio")
const fluxHistory = []

const latido = createLatido()
  .use(dom())
  .use(audio({ element: audioElement }))

latido.signal("audio.energy")
  .smooth(0.15)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--energy")

latido.signal("audio.beat")
  .decay(0.2)
  .bindStyle(".beat-button", "transform", value => `scale(${1 + value * 0.12})`)
  .bindClass(".beat-button", "is-beating", value => value > 0.5)
  .bindClass(document.body, "is-beating", value => value > 0.5)

latido.signal("audio.flux")
  .smooth(0.08)
  .bindCSSVar(document.body, "--flux")

latido.signal("audio.impact")
  .bindCSSVar(document.body, "--impact")

latido.signal("audio.bass")
  .smooth(0.1)
  .bindCSSVar(".bar-bass", "--level")

latido.signal("audio.mid")
  .smooth(0.1)
  .bindCSSVar(".bar-mid", "--level")

latido.signal("audio.treble")
  .smooth(0.1)
  .bindCSSVar(".bar-treble", "--level")

latido.start()

let playing = false

button.addEventListener("click", async () => {
  if (playing) {
    latido.pause()
    button.textContent = "Play"
    playing = false
    return
  }

  await latido.play()
  button.textContent = "Pause"
  playing = true
})

debugToggle.addEventListener("click", () => {
  const isHidden = debugPanel.classList.toggle("is-hidden")
  debugToggle.setAttribute("aria-pressed", String(!isHidden))
})

drawAudioDebug()

function drawAudioDebug() {
  const ctx = debugCanvas.getContext("2d")
  const dpr = window.devicePixelRatio || 1
  const rect = debugCanvas.getBoundingClientRect()
  const width = Math.max(1, Math.floor(rect.width))
  const height = Math.max(1, Math.floor(rect.height))

  if (debugCanvas.width !== width * dpr || debugCanvas.height !== height * dpr) {
    debugCanvas.width = width * dpr
    debugCanvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  ctx.clearRect(0, 0, width, height)

  if (!debugPanel.classList.contains("is-hidden")) {
    const state = latido.audioDebug?.()
    drawDebugFrame(ctx, state, width, height)
  }

  requestAnimationFrame(drawAudioDebug)
}

function drawDebugFrame(ctx, state, width, height) {
  ctx.fillStyle = "rgba(12, 14, 16, 0.82)"
  ctx.fillRect(0, 0, width, height)

  drawLabel(ctx, "waveform", 12, 16)
  drawLabel(ctx, "spectrum", width * 0.36, 16)
  drawLabel(ctx, "bands", width * 0.72, 16)
  drawLabel(ctx, "flux", 12, height * 0.62)

  if (!state?.timeData || !state?.frequencyData) {
    drawEmpty(ctx, width, height)
    return
  }

  drawWaveform(ctx, state.timeData, 12, 28, width * 0.3, height * 0.36)
  drawSpectrum(ctx, state.frequencyData, width * 0.36, 28, width * 0.3, height * 0.36)
  drawBands(ctx, state.values, width * 0.72, 28, width * 0.22, height * 0.36)
  drawFlux(ctx, state, 12, height * 0.68, width - 24, height * 0.24)
  drawBeat(ctx, state.values.beat, width, height)
}

function drawWaveform(ctx, data, x, y, width, height) {
  const mid = y + height / 2

  ctx.strokeStyle = "rgba(247, 241, 232, 0.28)"
  ctx.beginPath()
  ctx.moveTo(x, mid)
  ctx.lineTo(x + width, mid)
  ctx.stroke()

  ctx.strokeStyle = "#7ee2d6"
  ctx.lineWidth = 1.5
  ctx.beginPath()

  for (let index = 0; index < data.length; index += 1) {
    const px = x + (index / (data.length - 1)) * width
    const py = mid + data[index] * height * 0.42
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }

  ctx.stroke()
}

function drawSpectrum(ctx, data, x, y, width, height) {
  const bars = 64
  const barWidth = width / bars

  for (let index = 0; index < bars; index += 1) {
    const sample = data[Math.floor((index / bars) * data.length)] / 255
    const hue = 350 + index * 2.6
    const barHeight = sample * height

    ctx.fillStyle = `hsl(${hue}, 86%, 64%)`
    ctx.fillRect(x + index * barWidth, y + height - barHeight, Math.max(1, barWidth - 1), barHeight)
  }
}

function drawBands(ctx, values, x, y, width, height) {
  const bands = [
    ["bass", values.bass, "#ff5a5f"],
    ["mid", values.mid, "#7ee2d6"],
    ["treble", values.treble, "#ffd166"]
  ]
  const gap = 10
  const barWidth = (width - gap * 2) / 3

  for (let index = 0; index < bands.length; index += 1) {
    const [name, value, color] = bands[index]
    const barHeight = value * height
    const bx = x + index * (barWidth + gap)

    ctx.fillStyle = "rgba(247, 241, 232, 0.12)"
    ctx.fillRect(bx, y, barWidth, height)
    ctx.fillStyle = color
    ctx.fillRect(bx, y + height - barHeight, barWidth, barHeight)
    drawLabel(ctx, name, bx, y + height + 14)
  }
}

function drawFlux(ctx, state, x, y, width, height) {
  fluxHistory.push(state.values.flux ?? 0)
  while (fluxHistory.length > width) fluxHistory.shift()

  ctx.strokeStyle = "rgba(247, 241, 232, 0.2)"
  ctx.strokeRect(x, y, width, height)

  ctx.strokeStyle = "#ffffff"
  ctx.beginPath()

  for (let index = 0; index < fluxHistory.length; index += 1) {
    const value = Math.min(1, fluxHistory[index])
    const px = x + width - fluxHistory.length + index
    const py = y + height - value * height
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }

  ctx.stroke()

  drawMiniFluxBars(ctx, state, x + width - 130, y + 10)
}

function drawMiniFluxBars(ctx, state, x, y) {
  const fluxes = [
    [state.values.bassFlux, "#ff5a5f"],
    [state.values.midFlux, "#7ee2d6"],
    [state.values.trebleFlux, "#ffd166"]
  ]

  for (let index = 0; index < fluxes.length; index += 1) {
    const [value, color] = fluxes[index]
    ctx.fillStyle = color
    ctx.fillRect(x, y + index * 10, Math.min(110, value * 110), 6)
  }
}

function drawBeat(ctx, beat, width, height) {
  if (beat !== 1) return

  ctx.fillStyle = "rgba(255, 45, 64, 0.9)"
  ctx.fillRect(0, 0, width, 6)
  ctx.fillRect(0, height - 6, width, 6)
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = "rgba(247, 241, 232, 0.55)"
  ctx.font = "12px ui-sans-serif, system-ui"
  ctx.fillText("Press Play to initialize audio analysis", 12, height - 16)
}

function drawLabel(ctx, text, x, y) {
  ctx.fillStyle = "rgba(247, 241, 232, 0.62)"
  ctx.font = "11px ui-sans-serif, system-ui"
  ctx.fillText(text, x, y)
}
