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
        beat: 0
      },
      averageEnergy: 0,
      lastBeatAt: -Infinity
    }

    if (!state.element && options.file) {
      state.element = new Audio(options.file)
      state.element.crossOrigin = "anonymous"
      state.element.loop = true
    }

    latido.source("audio.energy", () => {
      updateAnalysis(state)
      return state.values.energy
    })

    latido.source("audio.bass", () => state.values.bass)
    latido.source("audio.mid", () => state.values.mid)
    latido.source("audio.treble", () => state.values.treble)
    latido.source("audio.beat", () => state.values.beat)

    latido.control("play", async () => {
      await ensureAudio(state, options)
      await state.context.resume()
      if (state.element) await state.element.play()
    })

    latido.control("pause", () => {
      if (state.element) state.element.pause()
      if (state.context) state.context.suspend()
    })
  }
}

async function ensureAudio(state, options) {
  if (state.context) return

  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
  state.context = new AudioContext()
  state.analyser = state.context.createAnalyser()
  state.analyser.fftSize = 1024
  state.analyser.smoothingTimeConstant = 0.72
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

function updateAnalysis(state) {
  if (!state.analyser) return

  state.analyser.getByteFrequencyData(state.frequencyData)
  state.analyser.getFloatTimeDomainData(state.timeData)

  state.values.energy = rms(state.timeData)
  state.values.bass = averageBand(state.frequencyData, 20, 250, state.context.sampleRate)
  state.values.mid = averageBand(state.frequencyData, 250, 2000, state.context.sampleRate)
  state.values.treble = averageBand(state.frequencyData, 2000, 8000, state.context.sampleRate)

  const now = state.context.currentTime * 1000
  state.averageEnergy = state.averageEnergy * 0.96 + state.values.energy * 0.04

  const threshold = Math.max(0.16, state.averageEnergy * 1.45)
  const cooldown = 180
  const isBeat = state.values.energy > threshold && now - state.lastBeatAt > cooldown

  state.values.beat = isBeat ? 1 : 0
  if (isBeat) state.lastBeatAt = now
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
