/**
 * Creates the Latido browser events source plugin.
 *
 * @param {object} [options]
 * @param {boolean} [options.pointer]
 * @param {boolean} [options.click]
 * @param {boolean} [options.scroll]
 * @param {boolean} [options.visibility]
 * @param {boolean} [options.motion]
 * @param {boolean} [options.orientation]
 * @param {number} [options.clickPulseMs]
 * @returns {(latido: import("@latido/core").createLatido) => void}
 */
export function events(options = {}) {
  return latido => {
    const config = {
      pointer: options.pointer ?? true,
      click: options.click ?? true,
      scroll: options.scroll ?? true,
      visibility: options.visibility ?? true,
      motion: options.motion ?? true,
      orientation: options.orientation ?? true,
      clickPulseMs: options.clickPulseMs ?? 220
    }
    const state = createState()
    const teardown = []

    registerSources(latido, state)

    if (config.pointer) teardown.push(listenPointer(state))
    if (config.click) teardown.push(listenClick(state, config.clickPulseMs))
    if (config.scroll) teardown.push(listenScroll(state))
    if (config.visibility) teardown.push(listenVisibility(state))
    if (config.motion) teardown.push(listenMotion(state))
    if (config.orientation) teardown.push(listenOrientation(state))

    latido.control("eventsDebug", () => state)
    latido.control("stopEvents", () => {
      for (const stop of teardown) stop?.()
      teardown.length = 0
    })
  }
}

function createState() {
  return {
    pointer: { x: 0, y: 0, progressX: 0, progressY: 0, down: 0 },
    click: { pulseUntil: 0 },
    scroll: { x: 0, y: 0, progressX: 0, progressY: 0 },
    visibility: { visible: typeof document === "undefined" || document.visibilityState === "visible" ? 1 : 0 },
    motion: { x: 0, y: 0, z: 0 },
    orientation: { alpha: 0, beta: 0, gamma: 0 }
  }
}

function registerSources(latido, state) {
  latido.source("event.pointer.x", () => state.pointer.x)
  latido.source("event.pointer.y", () => state.pointer.y)
  latido.source("event.pointer.progressX", () => state.pointer.progressX)
  latido.source("event.pointer.progressY", () => state.pointer.progressY)
  latido.source("event.pointer.down", () => state.pointer.down)
  latido.source("event.click.pulse", context => context.time <= state.click.pulseUntil ? 1 : 0)
  latido.source("event.scroll.x", () => state.scroll.x)
  latido.source("event.scroll.y", () => state.scroll.y)
  latido.source("event.scroll.progressX", () => state.scroll.progressX)
  latido.source("event.scroll.progressY", () => state.scroll.progressY)
  latido.source("event.visibility.visible", () => state.visibility.visible)
  latido.source("event.motion.x", () => state.motion.x)
  latido.source("event.motion.y", () => state.motion.y)
  latido.source("event.motion.z", () => state.motion.z)
  latido.source("event.orientation.alpha", () => state.orientation.alpha)
  latido.source("event.orientation.beta", () => state.orientation.beta)
  latido.source("event.orientation.gamma", () => state.orientation.gamma)
}

function listenPointer(state) {
  const onPointerMove = event => updatePointer(state, event)
  const onPointerDown = event => {
    updatePointer(state, event)
    state.pointer.down = 1
  }
  const onPointerUp = event => {
    updatePointer(state, event)
    state.pointer.down = 0
  }

  globalThis.addEventListener?.("pointermove", onPointerMove, { passive: true })
  globalThis.addEventListener?.("pointerdown", onPointerDown, { passive: true })
  globalThis.addEventListener?.("pointerup", onPointerUp, { passive: true })
  globalThis.addEventListener?.("pointercancel", onPointerUp, { passive: true })

  return () => {
    globalThis.removeEventListener?.("pointermove", onPointerMove)
    globalThis.removeEventListener?.("pointerdown", onPointerDown)
    globalThis.removeEventListener?.("pointerup", onPointerUp)
    globalThis.removeEventListener?.("pointercancel", onPointerUp)
  }
}

function listenClick(state, pulseMs) {
  const onClick = () => {
    state.click.pulseUntil = now() + pulseMs
  }

  globalThis.addEventListener?.("click", onClick, { passive: true })
  return () => globalThis.removeEventListener?.("click", onClick)
}

function listenScroll(state) {
  const update = () => {
    const maxX = Math.max(1, getScrollWidth() - getWidth())
    const maxY = Math.max(1, getScrollHeight() - getHeight())

    state.scroll.x = globalThis.scrollX ?? 0
    state.scroll.y = globalThis.scrollY ?? 0
    state.scroll.progressX = state.scroll.x / maxX
    state.scroll.progressY = state.scroll.y / maxY
  }

  update()
  globalThis.addEventListener?.("scroll", update, { passive: true })
  globalThis.addEventListener?.("resize", update, { passive: true })

  return () => {
    globalThis.removeEventListener?.("scroll", update)
    globalThis.removeEventListener?.("resize", update)
  }
}

function listenVisibility(state) {
  const update = () => {
    state.visibility.visible = document.visibilityState === "visible" ? 1 : 0
  }

  document?.addEventListener?.("visibilitychange", update)
  return () => document?.removeEventListener?.("visibilitychange", update)
}

function listenMotion(state) {
  const onMotion = event => {
    const acceleration = event.accelerationIncludingGravity ?? event.acceleration ?? {}

    state.motion.x = normalizeAcceleration(acceleration.x)
    state.motion.y = normalizeAcceleration(acceleration.y)
    state.motion.z = normalizeAcceleration(acceleration.z)
  }

  globalThis.addEventListener?.("devicemotion", onMotion, { passive: true })
  return () => globalThis.removeEventListener?.("devicemotion", onMotion)
}

function listenOrientation(state) {
  const onOrientation = event => {
    state.orientation.alpha = normalizeAngle(event.alpha, 360)
    state.orientation.beta = normalizeSignedAngle(event.beta, 180)
    state.orientation.gamma = normalizeSignedAngle(event.gamma, 90)
  }

  globalThis.addEventListener?.("deviceorientation", onOrientation, { passive: true })
  return () => globalThis.removeEventListener?.("deviceorientation", onOrientation)
}

function updatePointer(state, event) {
  const width = getWidth()
  const height = getHeight()

  state.pointer.x = event.clientX
  state.pointer.y = event.clientY
  state.pointer.progressX = width > 0 ? event.clientX / width : 0
  state.pointer.progressY = height > 0 ? event.clientY / height : 0
}

function getWidth() {
  return globalThis.innerWidth ?? 0
}

function getHeight() {
  return globalThis.innerHeight ?? 0
}

function getScrollWidth() {
  return document?.documentElement?.scrollWidth ?? getWidth()
}

function getScrollHeight() {
  return document?.documentElement?.scrollHeight ?? getHeight()
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function normalizeAcceleration(value) {
  return Math.min(1, Math.max(-1, (Number(value) || 0) / 9.81))
}

function normalizeAngle(value, range) {
  return clamp01((Number(value) || 0) / range)
}

function normalizeSignedAngle(value, range) {
  return Math.min(1, Math.max(-1, (Number(value) || 0) / range))
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}
