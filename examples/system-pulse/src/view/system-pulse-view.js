const systemConfig = {
  market: {
    title: "Market Pulse",
    traditionalTitle: "Market data",
    statusLabel: "Market",
    cold: "#dc404f",
    hot: "#28d28c",
    metrics: [
      { key: "price", label: "Price", source: "market.price", format: value => value.toFixed(2) },
      { key: "delta", label: "Delta", source: "market.delta", format: value => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` },
      { key: "volume", label: "Activity", source: "market.volume", format: value => value.toFixed(2) },
      { key: "volatility", label: "Volatility", source: "market.volatility", format: value => value.toFixed(2) }
    ]
  },
  weather: {
    title: "Weather Pulse",
    traditionalTitle: "Weather data",
    statusLabel: "Weather",
    cold: "#5292e0",
    hot: "#ee9358",
    metrics: [
      { key: "temperature", label: "Temperature", source: "weather.temperature", format: value => `${value.toFixed(1)} C` },
      { key: "wind", label: "Wind", source: "weather.wind", format: value => `${value.toFixed(1)} km/h` },
      { key: "pressure", label: "Pressure", source: "weather.pressure", format: value => `${value.toFixed(0)} hPa` },
      { key: "precipitation", label: "Precipitation", source: "weather.precipitation", format: value => `${value.toFixed(1)} mm` }
    ]
  }
}

const healthPalette = {
  thriving: { cold: "#27d59b", hot: "#f1d46b" },
  healthy: { cold: "#5292e0", hot: "#28d28c" },
  stable: { cold: "#68a7d8", hot: "#a8d7ba" },
  normal: { cold: "#7ea0df", hot: "#b8d889" },
  unstable: { cold: "#8b7ad8", hot: "#f0b35a" },
  stressed: { cold: "#ee9358", hot: "#f1c45d" },
  sick: { cold: "#6d7480", hot: "#dc404f" },
  recovering: { cold: "#7ea0df", hot: "#9ee6b7" },
  unknown: { cold: "#7b8490", hot: "#c5ccd3" }
}

export function createSystemPulseView(options = {}) {
  const root = options.root ?? document.documentElement
  const body = options.body ?? document.body
  const tabs = Array.from(options.tabs ?? document.querySelectorAll("[data-system]"))
  const core = options.core ?? document.querySelector("latido-pulse-core")
  const readout = options.readout ?? document.querySelector("latido-signal-readout")
  const locationSelect = options.locationSelect ?? document.querySelector(".location-select")
  const traditionalTitle = options.traditionalTitle ?? document.querySelector(".traditional-title")
  const sourceStatus = options.sourceStatus ?? document.querySelector(".source-status")
  const sourceMeta = options.sourceMeta ?? document.querySelector(".source-meta")
  const healthBadge = options.healthBadge ?? document.querySelector(".health-badge")
  const healthReason = options.healthReason ?? document.querySelector(".health-reason")
  const dataTable = options.dataTable ?? document.querySelector(".data-table")
  const miniChart = options.miniChart ?? document.querySelector(".mini-chart")
  const state = {
    system: "market",
    latido: null,
    sources: {
      market: null,
      weather: null
    }
  }

  setupLocations(options.weatherLocations ?? [])

  for (const tab of tabs) {
    tab.addEventListener("click", () => setSystem(tab.dataset.system))
  }

  setSystem(state.system)
  requestAnimationFrame(updateReadout)

  return {
    get system() {
      return state.system
    },
    connect(latido) {
      state.latido = latido
      locationSelect?.addEventListener("change", () => latido.setWeatherLocation?.(locationSelect.value))
      return this
    },
    setSignal(system, name, value) {
      if (state.system !== system) return
      root.style.setProperty(`--${name}`, Number(value).toFixed(4))
    },
    updateSources(snapshot) {
      state.sources = snapshot
      renderTraditional()
    },
    setSystem
  }

  function setupLocations(locations) {
    if (!locationSelect) return

    locationSelect.replaceChildren(...locations.map(location => {
      const option = document.createElement("option")
      option.value = location.id
      option.textContent = location.label
      return option
    }))
  }

  function setSystem(system) {
    if (!systemConfig[system]) return
    state.system = system
    const config = systemConfig[system]
    body.dataset.system = system

    for (const tab of tabs) {
      const active = tab.dataset.system === system
      tab.classList.toggle("is-active", active)
      tab.setAttribute("aria-pressed", String(active))
    }

    core?.setAttribute("system", system)
    readout?.setTitle(config.title)
    readout?.setItems(config.metrics.slice(0, 3).map(metric => ({
      key: metric.key,
      label: metric.label,
      value: ""
    })))
    renderTraditional()
  }

  function updateReadout() {
    const config = systemConfig[state.system]

    if (state.latido && readout && config) {
      for (const metric of config.metrics.slice(0, 3)) {
        readout.setValue(metric.key, metric.format(state.latido.values.get(metric.source) ?? 0))
      }
    }

    requestAnimationFrame(updateReadout)
  }

  function renderTraditional() {
    const config = systemConfig[state.system]
    const source = state.sources[state.system]
    const health = source?.health ?? { state: "unknown", reason: "Waiting for data", score: 0.5, trend: "stable", intensity: 0.2 }
    if (!config) return

    traditionalTitle.textContent = config.traditionalTitle
    sourceStatus.textContent = `${config.statusLabel}: ${source?.status ?? "starting"}${source?.provider ? ` (${source.provider})` : ""}`
    renderSourceMeta(source)
    healthBadge.textContent = health.state[0].toUpperCase() + health.state.slice(1)
    healthReason.textContent = health.reason
    body.dataset.health = health.state
    root.style.setProperty("--health-score", health.score.toFixed(4))
    root.style.setProperty("--health-intensity", health.intensity.toFixed(4))
    root.style.setProperty("--health-trend", health.trend === "improving" ? "1" : health.trend === "worsening" ? "0" : "0.5")
    root.style.setProperty("--latido-cold", (healthPalette[health.state] ?? healthPalette.unknown).cold)
    root.style.setProperty("--latido-hot", (healthPalette[health.state] ?? healthPalette.unknown).hot)
    locationSelect.hidden = state.system !== "weather"
    dataTable.replaceChildren(...config.metrics.map(metric => metricRow(metric, source)))
    renderHealthSparkline(source?.history ?? [], health)
  }

  function metricRow(metric, source) {
    const row = document.createElement("div")
    const label = document.createElement("dt")
    const value = document.createElement("dd")
    label.textContent = metric.label
    value.textContent = metric.format(source?.values?.[metric.source] ?? state.latido?.values.get(metric.source) ?? 0)
    row.append(label, value)
    return row
  }

  function renderSourceMeta(source) {
    if (!sourceMeta) return

    const label = source?.source?.label ?? "waiting for first sample"
    const location = source?.label ? ` · ${source.label}` : ""

    if (source?.source?.external && source.source.url) {
      const link = document.createElement("a")
      link.href = source.source.url
      link.target = "_blank"
      link.rel = "noreferrer"
      link.textContent = label
      sourceMeta.replaceChildren("Data source: ", link, location)
      return
    }

    sourceMeta.textContent = `Data source: ${label}${location} · no external data`
  }

  function renderHealthSparkline(history, health) {
    if (!miniChart) return

    const values = history
      .map(item => Number(item.healthScore ?? item.health?.score))
      .filter(Number.isFinite)
      .slice(-32)
    const scores = values.length ? values : [health.score ?? 0.5]
    const points = scores
      .map((value, index) => {
        const x = scores.length === 1 ? 48 : (index / (scores.length - 1)) * 96
        const y = 30 - clamp(value) * 24
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(" ")
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line")

    svg.setAttribute("viewBox", "0 0 96 32")
    svg.setAttribute("role", "presentation")
    baseline.setAttribute("x1", "0")
    baseline.setAttribute("x2", "96")
    baseline.setAttribute("y1", "16")
    baseline.setAttribute("y2", "16")
    path.setAttribute("points", points)
    path.setAttribute("fill", "none")
    path.setAttribute("vector-effect", "non-scaling-stroke")
    svg.append(baseline, path)
    miniChart.replaceChildren(svg)
  }
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}
