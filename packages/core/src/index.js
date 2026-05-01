/**
 * Creates a Latido engine instance.
 *
 * @param {object} [options]
 * @param {(callback: FrameRequestCallback) => number} [options.requestFrame]
 * @param {(id: number) => void} [options.cancelFrame]
 * @param {() => number} [options.now]
 * @returns {Latido}
 */
export function createLatido(options = {}) {
  return new Latido(options)
}

class Latido {
  constructor(options = {}) {
    this.sources = new Map()
    this.values = new Map()
    this.signals = new Set()
    this.plugins = new Set()
    this.controls = new Map()
    this.signalExtensions = new Map()
    this.adapterSets = new Map()

    this.running = false
    this.frame = null
    this.time = 0
    this.delta = 0
    this.lastTime = null

    this.requestFrame = options.requestFrame ?? globalThis.requestAnimationFrame?.bind(globalThis)
    this.cancelFrame = options.cancelFrame ?? globalThis.cancelAnimationFrame?.bind(globalThis)
    this.now = options.now ?? globalThis.performance?.now?.bind(globalThis.performance) ?? Date.now

    if (!this.requestFrame) {
      this.requestFrame = callback => globalThis.setTimeout(() => callback(this.now()), 16)
      this.cancelFrame = id => globalThis.clearTimeout(id)
    }
  }

  /**
   * Installs a plugin.
   *
   * @param {(latido: Latido) => unknown} plugin
   * @returns {this}
   */
  use(plugin) {
    if (this.plugins.has(plugin)) return this
    this.plugins.add(plugin)
    plugin(this)
    return this
  }

  /**
   * Registers a source reader.
   *
   * @param {string} name
   * @param {(context: TickContext) => number} reader
   * @returns {this}
   */
  source(name, reader) {
    this.sources.set(name, reader)
    return this
  }

  /**
   * Registers a domain adapter set as normalized sources.
   *
   * @param {string} namespace Source namespace, for example "hmi".
   * @param {object} options
   * @param {Record<string, Adapter>} options.adapters
   * @param {string} [options.initial]
   * @param {string[]} [options.signals]
   * @param {boolean} [options.clamp]
   * @param {string[]} [options.wrap]
   * @returns {this}
   */
  adapt(namespace, options = {}) {
    const name = String(namespace || "").trim()
    if (!name) throw new Error("Latido adapters require a namespace.")

    const registry = new Map(Object.entries(options.adapters ?? {}))
    if (registry.size === 0) throw new Error(`Latido adapter set "${name}" requires adapters.`)

    const signals = options.signals?.length ? [...options.signals] : [
      "energy",
      "pulse",
      "flow",
      "volatility",
      "phase",
      "primary",
      "secondary",
      "tertiary"
    ]
    const initial = options.initial ?? registry.keys().next().value

    if (!registry.has(initial)) {
      throw new Error(`Unknown initial adapter "${initial}" for "${name}".`)
    }

    const state = {
      namespace: name,
      adapters: registry,
      active: initial,
      signals,
      values: Object.fromEntries(signals.map(signal => [signal, 0])),
      clamp: options.clamp ?? true,
      wrap: new Set(options.wrap ?? ["phase"]),
      lastUpdateTime: null
    }

    this.adapterSets.set(name, state)

    for (const signal of signals) {
      this.source(`${name}.${signal}`, context => {
        this.updateAdapter(name, context)
        return state.values[signal] ?? 0
      })
    }

    return this
  }

  /**
   * Selects the active adapter for a namespace.
   *
   * @param {string} namespace
   * @param {string} adapterName
   * @returns {this}
   */
  useAdapter(namespace, adapterName) {
    const state = this.getAdapterState(namespace)
    if (!state.adapters.has(adapterName)) {
      throw new Error(`Unknown adapter "${adapterName}" for "${namespace}".`)
    }

    state.active = adapterName
    state.lastUpdateTime = null
    return this
  }

  /**
   * Returns the active adapter descriptor.
   *
   * @param {string} namespace
   * @returns {{ name: string, adapter: Adapter }}
   */
  activeAdapter(namespace) {
    const state = this.getAdapterState(namespace)
    return {
      name: state.active,
      adapter: state.adapters.get(state.active)
    }
  }

  /**
   * Returns adapter set state for inspection.
   *
   * @param {string} namespace
   * @returns {object}
   */
  adapterDebug(namespace) {
    return this.getAdapterState(namespace)
  }

  /**
   * Sets a source value manually.
   *
   * @param {string} name
   * @param {number} value
   * @returns {this}
   */
  set(name, value) {
    const number = Number(value)
    this.values.set(name, Number.isFinite(number) ? number : 0)
    return this
  }

  /**
   * Creates a new signal pipeline for a named source (not reused).
   *
   * @param {string} name
   * @returns {Signal}
   */
  signal(name) {
    const signal = new Signal(this, name)
    this.signals.add(signal)
    return signal
  }

  /**
   * Adds a chainable method to this instance's signals.
   *
   * @param {string} name
   * @param {(signal: Signal, ...args: unknown[]) => Signal} handler
   * @returns {this}
   */
  extendSignal(name, handler) {
    if (Signal.prototype[name] || this[name] || this.signalExtensions.has(name)) {
      throw new Error(`Cannot extend signal with reserved method "${name}".`)
    }

    this.signalExtensions.set(name, handler)

    for (const signal of this.signals) {
      signal.installExtension(name, handler)
    }

    return this
  }

  /**
   * Exposes a named plugin control on the Latido instance.
   *
   * @param {string} name
   * @param {Function} control
   * @returns {this}
   */
  control(name, control) {
    if (this[name] && this[name] !== control) {
      throw new Error(`Cannot register control with reserved name "${name}".`)
    }

    this.controls.set(name, control)
    this[name] = control
    return this
  }

  /**
   * Starts the animation frame scheduler.
   *
   * @returns {this}
   */
  start() {
    if (this.running) return this
    this.running = true
    this.lastTime = null
    this.frame = this.requestFrame(time => this.tick(time))
    return this
  }

  /**
   * Stops the animation frame scheduler.
   *
   * @returns {this}
   */
  stop() {
    this.running = false
    if (this.frame !== null) this.cancelFrame(this.frame)
    this.frame = null
    return this
  }

  /**
   * Runs one scheduler update.
   *
   * @param {number} [time]
   * @returns {this}
   */
  tick(time = this.now()) {
    this.delta = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime)
    this.time = time
    this.lastTime = time

    const context = this.context()

    for (const [name, reader] of this.sources) {
      const value = reader(context)
      if (value !== undefined) this.set(name, value)
    }

    for (const signal of this.signals) {
      signal.update(context)
    }

    if (this.running) {
      this.frame = this.requestFrame(nextTime => this.tick(nextTime))
    }

    return this
  }

  /**
   * Returns the current tick context.
   *
   * @returns {TickContext}
   */
  context() {
    return {
      latido: this,
      time: this.time,
      delta: this.delta
    }
  }

  updateAdapter(namespace, context) {
    const state = this.getAdapterState(namespace)
    if (state.lastUpdateTime === context.time) return state.values
    state.lastUpdateTime = context.time

    const adapter = state.adapters.get(state.active)
    const next = adapter?.read?.(context) ?? {}

    for (const signal of state.signals) {
      state.values[signal] = normalizeAdapterValue(next[signal], {
        clamp: state.clamp,
        wrap: state.wrap.has(signal)
      })
    }

    return state.values
  }

  getAdapterState(namespace) {
    const state = this.adapterSets.get(namespace)
    if (!state) throw new Error(`Unknown adapter namespace "${namespace}".`)
    return state
  }
}

export class Signal {
  constructor(latido, name) {
    this.latido = latido
    this.name = name
    this.transforms = []
    this.bindings = []
    this.state = new Map()
    this.value = 0

    for (const [extensionName, handler] of latido.signalExtensions) {
      this.installExtension(extensionName, handler)
    }
  }

  /**
   * Installs an instance-scoped signal extension.
   *
   * @param {string} name
   * @param {(signal: Signal, ...args: unknown[]) => Signal} handler
   * @returns {this}
   */
  installExtension(name, handler) {
    Object.defineProperty(this, name, {
      configurable: true,
      value: (...args) => handler(this, ...args)
    })

    return this
  }

  /**
   * Adds a custom transform.
   *
   * @param {(value: number, context: SignalContext) => number} fn
   * @returns {this}
   */
  map(fn) {
    this.transforms.push((value, context) => Number(fn(value, context)) || 0)
    return this
  }

  /**
   * Clamps the signal to a range.
   *
   * @param {number} min
   * @param {number} max
   * @returns {this}
   */
  clamp(min, max) {
    return this.map(value => Math.min(max, Math.max(min, value)))
  }

  /**
   * Normalizes a value from a range into 0..1.
   *
   * @param {number} min
   * @param {number} max
   * @returns {this}
   */
  normalize(min, max) {
    const range = max - min || 1
    return this.map(value => (value - min) / range)
  }

  /**
   * Smooths the signal using linear interpolation.
   *
   * @param {number} amount 0 keeps the previous value, 1 follows immediately.
   * @returns {this}
   */
  smooth(amount = 0.1) {
    const key = Symbol("smooth")
    const alpha = clamp01(amount)

    this.transforms.push((value) => {
      const previous = this.state.has(key) ? this.state.get(key) : value
      const next = previous + (value - previous) * alpha
      this.state.set(key, next)
      return next
    })

    return this
  }

  /**
   * Lets values rise immediately and fall gradually.
   *
   * @param {number} amount Fall amount per frame in 0..1.
   * @returns {this}
   */
  decay(amount = 0.1) {
    const key = Symbol("decay")
    const fall = clamp01(amount)

    this.transforms.push(value => {
      const previous = this.state.get(key) ?? 0
      const next = Math.max(value, previous * (1 - fall))
      this.state.set(key, next)
      return next
    })

    return this
  }

  /**
   * Converts the signal to 1 when it reaches a limit, otherwise 0.
   *
   * @param {number} limit
   * @returns {this}
   */
  threshold(limit = 0.5) {
    return this.map(value => value >= limit ? 1 : 0)
  }

  /**
   * Emits 1 for a short duration when the input rises above zero.
   *
   * @param {number} duration Duration in milliseconds.
   * @returns {this}
   */
  pulse(duration = 120) {
    const key = Symbol("pulse")

    this.transforms.push((value, context) => {
      const state = this.state.get(key) ?? { activeUntil: 0, wasOn: false }
      const isOn = value > 0

      if (isOn && !state.wasOn) {
        state.activeUntil = context.time + duration
      }

      state.wasOn = isOn
      this.state.set(key, state)

      return context.time <= state.activeUntil ? 1 : 0
    })

    return this
  }

  /**
   * Adds a binding function that receives the transformed value each tick.
   *
   * @param {(value: number, context: SignalContext) => void} binding
   * @returns {this}
   */
  bind(binding) {
    this.bindings.push(binding)
    return this
  }

  /**
   * Updates this signal and all bindings.
   *
   * @param {TickContext} context
   * @returns {number}
   */
  update(context) {
    let value = this.latido.values.get(this.name) ?? 0
    const signalContext = { ...context, signal: this }

    for (const transform of this.transforms) {
      value = transform(value, signalContext)
    }

    this.value = Number.isFinite(value) ? value : 0

    for (const binding of this.bindings) {
      binding(this.value, signalContext)
    }

    return this.value
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function normalizeAdapterValue(value, options) {
  const number = Number(value) || 0

  if (options.wrap) {
    return number - Math.floor(number)
  }

  return options.clamp ? clamp01(number) : number
}

/**
 * @typedef {object} TickContext
 * @property {Latido} latido
 * @property {number} time
 * @property {number} delta
 */

/**
 * @typedef {TickContext & { signal: Signal }} SignalContext
 */

/**
 * @typedef {object} Adapter
 * @property {string} [label]
 * @property {string} [mode]
 * @property {Record<string, string>} [labels]
 * @property {(context: TickContext) => Record<string, number>} read
 */
