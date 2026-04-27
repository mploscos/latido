const elementSources = new WeakMap()

/**
 * Creates the Latido audio plugin.
 *
 * @param {object} [options]
 * @param {string} [options.file]
 * @param {HTMLMediaElement} [options.element]
 * @param {boolean} [options.microphone]
 * @returns {(latido: import("@latido/core").createLatido) => void}
 */
export function audio(options = {}) {
  return latido => {
    const state = {
      context: null,
      analyser: null,
      source: null,
      element: options.element ?? null,
      stream: null,
      frequencyData: null,
      timeData: null,
      values: {
        energy: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        beat: 0,
        flux: 0,
        bassFlux: 0,
        midFlux: 0,
        trebleFlux: 0,
        impact: 0
      },
      raw: {
        energy: 0,
        bass: 0,
        mid: 0,
        treble: 0
      },
      energyAverage: 0,
      previousBass: 0,
      previousMid: 0,
      previousTreble: 0,
      bassFlux: 0,
      midFlux: 0,
      trebleFlux: 0,
      combinedFlux: 0,
      bassFluxAverage: 0,
      midFluxAverage: 0,
      trebleFluxAverage: 0,
      combinedFluxAverage: 0,
      lastBeatAt: -Infinity,
      lastAnalysisTime: null
    }

    if (!state.element && options.file) {
      state.element = new Audio(options.file)
      state.element.crossOrigin = "anonymous"
      state.element.loop = true
    }

    latido.source("audio.energy", context => {
      updateAnalysis(state, context)
      return state.values.energy
    })

    latido.source("audio.bass", context => {
      updateAnalysis(state, context)
      return state.values.bass
    })

    latido.source("audio.mid", context => {
      updateAnalysis(state, context)
      return state.values.mid
    })

    latido.source("audio.treble", context => {
      updateAnalysis(state, context)
      return state.values.treble
    })

    latido.source("audio.beat", context => {
      updateAnalysis(state, context)
      return state.values.beat
    })

    latido.source("audio.flux", context => {
      updateAnalysis(state, context)
      return state.values.flux
    })

    latido.source("audio.bassFlux", context => {
      updateAnalysis(state, context)
      return state.values.bassFlux
    })

    latido.source("audio.midFlux", context => {
      updateAnalysis(state, context)
      return state.values.midFlux
    })

    latido.source("audio.trebleFlux", context => {
      updateAnalysis(state, context)
      return state.values.trebleFlux
    })

    latido.source("audio.impact", context => {
      updateAnalysis(state, context)
      return state.values.impact
    })

    latido.control("play", async () => {
      await ensureAudio(state, options)
      await state.context.resume()
      if (state.element) await state.element.play()
    })

    latido.control("pause", () => {
      if (state.element) state.element.pause()
      if (state.context) state.context.suspend()
    })

    latido.control("audioDebug", () => state)
  }
}

async function ensureAudio(state, options) {
  if (state.context) return

  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
  state.context = new AudioContext()
  state.analyser = state.context.createAnalyser()
  state.analyser.fftSize = 2048
  state.analyser.smoothingTimeConstant = 0.25
  state.frequencyData = new Uint8Array(state.analyser.frequencyBinCount)
  state.timeData = new Float32Array(state.analyser.fftSize)

  if (options.microphone) {
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    state.source = state.context.createMediaStreamSource(state.stream)
    state.source.connect(state.analyser)
    return
  }

  if (!state.element) {
    throw new Error("Latido audio requires a file, element, or microphone option.")
  }

  state.source = elementSources.get(state.element)

  if (!state.source) {
    state.source = state.context.createMediaElementSource(state.element)
    elementSources.set(state.element, state.source)
  }

  state.source.connect(state.analyser)
  state.analyser.connect(state.context.destination)
}

function updateAnalysis(state, context) {
  if (!state.analyser) return
  if (state.lastAnalysisTime === context.time) return
  state.lastAnalysisTime = context.time

  state.analyser.getByteFrequencyData(state.frequencyData)
  state.analyser.getFloatTimeDomainData(state.timeData)

  state.raw.energy = rms(state.timeData)
  state.raw.bass = averageBand(state.frequencyData, 40, 160, state.context.sampleRate)
  state.raw.mid = averageBand(state.frequencyData, 160, 2000, state.context.sampleRate)
  state.raw.treble = averageBand(state.frequencyData, 2000, 8000, state.context.sampleRate)

  state.values.energy = smoothValue(state.values.energy, state.raw.energy, 0.25)
  state.values.bass = smoothValue(state.values.bass, state.raw.bass, 0.25)
  state.values.mid = smoothValue(state.values.mid, state.raw.mid, 0.2)
  state.values.treble = smoothValue(state.values.treble, state.raw.treble, 0.18)

  const now = state.context.currentTime * 1000
  state.bassFlux = Math.max(0, state.raw.bass - state.previousBass)
  state.midFlux = Math.max(0, state.raw.mid - state.previousMid)
  state.trebleFlux = Math.max(0, state.raw.treble - state.previousTreble)
  state.combinedFlux = state.bassFlux + state.midFlux * 0.65 + state.trebleFlux * 0.45

  state.energyAverage = state.energyAverage * 0.96 + state.raw.energy * 0.04
  state.bassFluxAverage = state.bassFluxAverage * 0.94 + state.bassFlux * 0.06
  state.midFluxAverage = state.midFluxAverage * 0.94 + state.midFlux * 0.06
  state.trebleFluxAverage = state.trebleFluxAverage * 0.94 + state.trebleFlux * 0.06
  state.combinedFluxAverage = state.combinedFluxAverage * 0.94 + state.combinedFlux * 0.06

  state.values.flux = normalizeFlux(state.combinedFlux, state.combinedFluxAverage)
  state.values.bassFlux = normalizeFlux(state.bassFlux, state.bassFluxAverage)
  state.values.midFlux = normalizeFlux(state.midFlux, state.midFluxAverage)
  state.values.trebleFlux = normalizeFlux(state.trebleFlux, state.trebleFluxAverage)

  const fluxThreshold = Math.max(0.025, state.combinedFluxAverage * 1.6)
  const energyThreshold = state.energyAverage * 1.08
  const isBeat = state.combinedFlux > fluxThreshold &&
    state.raw.energy > energyThreshold &&
    now - state.lastBeatAt > 160

  state.values.beat = isBeat ? 1 : 0
  if (isBeat) state.lastBeatAt = now
  state.values.impact = Math.max(
    state.values.impact * 0.72,
    Math.min(1, state.values.flux * 0.72 + (isBeat ? 0.55 : 0))
  )
  state.previousBass = state.raw.bass
  state.previousMid = state.raw.mid
  state.previousTreble = state.raw.treble
}

function normalizeFlux(value, average) {
  const baseline = Math.max(0.025, average * 2.4)
  return Math.min(1, value / baseline)
}

function smoothValue(previous, next, amount) {
  return previous + (next - previous) * amount
}

function rms(data) {
  let sum = 0

  for (const value of data) {
    sum += value * value
  }

  return Math.min(1, Math.sqrt(sum / data.length) * 2)
}

function averageBand(data, lowHz, highHz, sampleRate) {
  const nyquist = sampleRate / 2
  const low = Math.max(0, Math.floor((lowHz / nyquist) * data.length))
  const high = Math.min(data.length - 1, Math.ceil((highHz / nyquist) * data.length))

  if (high <= low) return 0

  let sum = 0

  for (let index = low; index <= high; index += 1) {
    sum += data[index]
  }

  return sum / ((high - low + 1) * 255)
}
