/**
 * Creates the Latido network source plugin.
 *
 * @param {object} [options]
 * @param {object | object[]} [options.webSocket]
 * @param {object | object[]} [options.sse]
 * @returns {(latido: import("@latido/core").createLatido) => void}
 */
export function network(options = {}) {
  return latido => {
    const channels = [
      ...normalizeChannels(options.webSocket).map(channel => ({ ...channel, transport: "websocket" })),
      ...normalizeChannels(options.sse ?? options.eventSource).map(channel => ({ ...channel, transport: "sse" }))
    ]
    const state = {
      values: new Map(),
      connections: []
    }

    for (const channel of channels) {
      registerChannelSources(latido, state, channel)
      state.connections.push(connectChannel(state, channel))
    }

    latido.control("closeNetwork", () => {
      for (const connection of state.connections) {
        connection?.close?.()
      }
      state.connections.length = 0
    })

    latido.control("networkDebug", () => state)
  }
}

function normalizeChannels(channel) {
  if (!channel) return []
  return Array.isArray(channel) ? channel : [channel]
}

function registerChannelSources(latido, state, channel) {
  const sources = Object.entries(channel.sources ?? {})

  for (const [name, selector] of sources) {
    state.values.set(name, Number(channel.initial ?? 0) || 0)
    latido.source(name, () => state.values.get(name) ?? 0)

    if (typeof selector === "function") continue
    if (typeof selector !== "string" && selector !== true) {
      throw new Error(`Network source "${name}" requires a path string, true, or mapper function.`)
    }
  }
}

function connectChannel(state, channel) {
  if (!channel.url) {
    throw new Error("Network channels require a url.")
  }

  if (channel.transport === "websocket") {
    return connectWebSocket(state, channel)
  }

  return connectEventSource(state, channel)
}

function connectWebSocket(state, channel) {
  const socket = new WebSocket(channel.url, channel.protocols)

  socket.addEventListener("message", event => {
    updateSources(state, channel, event.data, event)
  })

  return socket
}

function connectEventSource(state, channel) {
  const source = new EventSource(channel.url, channel.options)
  const eventName = channel.event ?? "message"

  source.addEventListener(eventName, event => {
    updateSources(state, channel, event.data, event)
  })

  return source
}

function updateSources(state, channel, data, event) {
  const payload = parsePayload(data)

  for (const [name, selector] of Object.entries(channel.sources ?? {})) {
    const next = readValue(payload, selector, event)
    const number = Number(next)
    state.values.set(name, Number.isFinite(number) ? number : 0)
  }
}

function parsePayload(data) {
  if (typeof data !== "string") return data

  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

function readValue(payload, selector, event) {
  if (typeof selector === "function") return selector(payload, event)
  if (selector === true) return payload

  return String(selector)
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => value?.[key], payload)
}
