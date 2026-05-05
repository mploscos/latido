import "./styles.css"

const base = import.meta.env.BASE_URL
const repo = "https://github.com/mploscos/latido"
const localExampleOrigin = `${location.protocol}//${location.hostname}:5173`
const localSystemPulseOrigin = `${location.protocol}//${location.hostname}:5176`

redirectDevFallbackRoutes()

const packages = [
  {
    name: "@latido/web",
    summary: "Convenience browser entrypoint for common projects.",
    use: "Use when you want one import for core plus browser plugins.",
    install: "npm install @latido/web",
    code: 'import { createLatido, dom, audio, signals } from "@latido/web"'
  },
  {
    name: "@latido/core",
    summary: "Scheduler, sources, signals, transforms and adapter sets.",
    use: "Use directly when building custom integrations or non-browser runtimes.",
    install: "npm install @latido/core",
    code: 'import { createLatido, signalPipe } from "@latido/core"'
  },
  {
    name: "@latido/dom",
    summary: "CSS variable, style, class and attribute bindings.",
    use: "Use when signals should drive HTML and CSS.",
    install: "npm install @latido/core @latido/dom",
    code: "latido.signal(audioSignals.energy).bindCSSVar(document.body, \"--energy\")"
  },
  {
    name: "@latido/audio",
    summary: "Web Audio analysis sources: energy, bands, flux, beat and impact.",
    use: "Use for music-reactive interfaces and safe audio debugging.",
    install: "npm install @latido/core @latido/audio",
    code: 'import { audio, audioSignals } from "@latido/audio"'
  },
  {
    name: "@latido/targets",
    summary: "Renderer-agnostic object property bindings.",
    use: "Use with PixiJS, Three.js, Canvas state objects or your own renderer.",
    install: "npm install @latido/core @latido/targets",
    code: "latido.signal(audioSignals.beat).bindTarget(mesh, \"scale\", v => 1 + v * 0.2)"
  },
  {
    name: "@latido/network",
    summary: "WebSocket and Server-Sent Events sources.",
    use: "Use when live network data should become Latido signals.",
    install: "npm install @latido/core @latido/network",
    code: 'latido.use(network({ sse: { url: "/events", sources: { "feed.energy": "energy" } } }))'
  },
  {
    name: "@latido/events",
    summary: "Browser event sources for pointer, click, scroll, visibility and motion.",
    use: "Use when user behavior or device movement should drive signals.",
    install: "npm install @latido/core @latido/events",
    code: 'import { events, eventSignals } from "@latido/events"'
  },
  {
    name: "@latido/waapi",
    summary: "Web Animations API bindings.",
    use: "Use when signals should scrub or trigger native browser animations.",
    install: "npm install @latido/core @latido/waapi",
    code: "latido.signal(audioSignals.beat).playAnimationOnPulse(animation)"
  }
]

const examples = [
  {
    title: "Basic Audio DOM",
    description: "A small audio-reactive DOM interface with CSS variables, beat bindings and optional audio debug readout.",
    signals: "audio.energy, audio.beat, audio.flux, audio.bass, audio.mid, audio.treble",
    targets: "DOM, CSS variables, classes, Canvas debug",
    live: "examples/basic.html",
    source: "examples/basic/src/main.js"
  },
  {
    title: "Multi-target",
    description: "One audio signal engine driving DOM, PixiJS, Canvas and Three.js together.",
    signals: "audio.energy, audio.beat, audio.flux",
    targets: "DOM, PixiJS, Canvas, Three.js",
    live: "examples/multi-target.html",
    source: "examples/basic/src/multi-target.js"
  },
  {
    title: "Adaptive HMI",
    description: "The same normalized bindings adapt across weather, biology, aeronautics, markets and browser events.",
    signals: "hmi.energy, hmi.pulse, hmi.flow, hmi.volatility",
    targets: "DOM, CSS variables, Latido components",
    live: "examples/adaptive-hmi.html",
    source: "examples/basic/src/adaptive-hmi.js"
  },
  {
    title: "System Pulse",
    description: "Weather and market data become perceptual health states in one living system demo.",
    signals: "weather.*, weather.weatherCode, weather.snowfall, weather.windGusts, market.*, healthScore, healthTrend, healthIntensity",
    targets: "DOM, Latido pulse components",
    live: "system-pulse/",
    source: "examples/system-pulse/src/main.js"
  },
  {
    title: "WAAPI Recipe",
    description: "Use signals to scrub animation progress or play an animation on a pulse.",
    signals: "audio.beat, event.click.pulse",
    targets: "Web Animations API",
    live: "#recipe-waapi",
    source: "packages/waapi/src/index.js"
  },
  {
    title: "Network / SSE / WebSocket Recipe",
    description: "Map JSON payloads from network streams into named Latido sources.",
    signals: "feed.energy, feed.pressure, feed.pulse",
    targets: "DOM, targets, custom bindings",
    live: "#recipe-sse",
    source: "packages/network/src/index.js"
  }
]

const recipes = [
  {
    id: "recipe-button-pulse",
    title: "Make a button pulse with audio",
    needs: `<audio id="music" src="/audio/demo.mp3"></audio>
<button class="button">Play</button>`,
    code: `import { createLatido, dom, audio, signals } from "@latido/web"

const audioEl = document.querySelector("#music")
const latido = createLatido()
  .use(dom())
  .use(audio({ element: audioEl }))

latido.signal(signals.audio.beat)
  .decay(0.2)
  .bindStyle(".button", "transform", v => \`scale(\${1 + v * 0.12})\`)

document.querySelector(".button").addEventListener("click", () => latido.play())
latido.start()`
  },
  {
    id: "recipe-css-vars",
    title: "Drive CSS variables from a signal",
    needs: `<audio id="music" src="/audio/demo.mp3"></audio>`,
    code: `import { createLatido, dom, audio, signals } from "@latido/web"

const latido = createLatido()
  .use(dom())
  .use(audio({ element: document.querySelector("#music") }))

latido.signal(signals.audio.energy)
  .smooth(0.14)
  .bindCSSVar(document.body, "--energy")

latido.start()`
  },
  {
    id: "recipe-targets",
    title: "Drive PixiJS or Three.js objects",
    needs: `A renderer object with a writable property, for example a Three.js mesh.`,
    code: `import { createLatido, audio, targets, signals } from "@latido/web"

const latido = createLatido()
  .use(audio({ element: document.querySelector("#music") }))
  .use(targets())

latido.signal(signals.audio.energy)
  .smooth(0.12)
  .bindTarget(mesh, "scale", v => 1 + v * 0.4)

latido.start()`
  },
  {
    id: "recipe-waapi",
    title: "Trigger Web Animations on events",
    needs: `<button class="pulse-button">Pulse</button>`,
    code: `import { createLatido, events, waapi, signals } from "@latido/web"

const element = document.querySelector(".pulse-button")
const keyframes = [
  { transform: "scale(1)" },
  { transform: "scale(1.18)" },
  { transform: "scale(1)" }
]
const animation = element.animate(keyframes, { duration: 420 })
animation.pause()

const latido = createLatido()
  .use(events())
  .use(waapi())

latido.signal(signals.event.clickPulse)
  .playAnimationOnPulse(animation)

latido.start()`
  },
  {
    id: "recipe-websocket",
    title: "Connect WebSocket data",
    needs: `A WebSocket endpoint that sends JSON such as {"metrics":{"energy":0.7}}.`,
    code: `import { createLatido, dom, network } from "@latido/web"

const latido = createLatido()
  .use(dom())
  .use(network({
  webSocket: {
    url: "wss://example.com/feed",
    sources: {
      "feed.energy": "metrics.energy",
      "feed.volatility": "metrics.volatility"
    }
  }
}))

latido.signal("feed.energy")
  .smooth(0.12)
  .bindCSSVar(document.body, "--energy")

latido.start()`
  },
  {
    id: "recipe-sse",
    title: "Connect SSE data",
    needs: `An SSE endpoint that emits JSON such as {"wind":12,"pressure":1014}.`,
    code: `import { createLatido, dom, network } from "@latido/web"

const latido = createLatido()
  .use(dom())
  .use(network({
  sse: {
    url: "/events",
    sources: {
      "weather.wind": "wind",
      "weather.pressure": "pressure"
    }
  }
}))

latido.signal("weather.wind")
  .normalize(0, 40)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--wind")

latido.start()`
  },
  {
    id: "recipe-health-state",
    title: "Create a health state from multiple signals",
    needs: `An SSE or WebSocket payload that exposes the raw inputs. In this example /system-events emits JSON such as {"energy":0.6,"pressure":0.2,"volatility":0.1}. The sources config names those payload fields as Latido signals.`,
    code: `import { createLatido, dom, network } from "@latido/web"

const clamp = value => Math.min(1, Math.max(0, value))

const latido = createLatido()
  .use(dom())
  .use(network({
    sse: {
      url: "/system-events",
      sources: {
        "system.energy": "energy",
        "system.pressure": "pressure",
        "system.volatility": "volatility"
      }
    }
  }))

latido.source("system.healthScore", ({ latido }) => {
  const energy = latido.values.get("system.energy") ?? 0
  const pressure = latido.values.get("system.pressure") ?? 0
  const volatility = latido.values.get("system.volatility") ?? 0

  return clamp(0.8 + energy * 0.1 - pressure * 0.25 - volatility * 0.35)
})

latido.signal("system.healthScore")
  .smooth(0.08)
  .bindCSSVar(document.body, "--health-score")

latido.start()`
  },
  {
    id: "recipe-safe-audio",
    title: "Build a safe audio-reactive UI",
    needs: `<audio id="music" src="/audio/demo.mp3"></audio>`,
    code: `import { createLatido, dom, audio, signals } from "@latido/web"

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
const intensity = reduceMotion ? 0.25 : 1
const latido = createLatido()
  .use(dom())
  .use(audio({ element: document.querySelector("#music") }))

latido.signal(signals.audio.energy)
  .smooth(0.1)
  .bindCSSVar(document.body, "--energy", v => v * intensity)

latido.start()`
  },
  {
    id: "recipe-reduced-motion",
    title: "Respect prefers-reduced-motion",
    needs: `CSS for any element that reacts to Latido-driven variables.`,
    code: `.reactive-layer {
  transform: scale(calc(1 + var(--energy, 0) * 0.12));
  transition: transform 120ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .reactive-layer {
    transition-duration: 900ms;
    transform: none;
  }
}`
  }
]

const api = [
  ["createLatido(options?)", "Creates the scheduler and signal registry."],
  ["latido.use(plugin)", "Installs a plugin that can register sources, controls or signal extensions."],
  ["latido.source(name, reader)", "Registers a named source reader. This is where custom signal names are created."],
  ["latido.signal(name)", "Creates a signal pipeline for an existing source name. Use signals.audio.energy from @latido/web when you want autocomplete."],
  ["latido.start() / latido.stop()", "Starts or stops the animation-frame scheduler."],
  ["latido.control(name, fn)", "Exposes a plugin control on the Latido instance."],
  ["latido.extendSignal(name, handler)", "Adds a chainable signal method for one Latido instance."],
  ["signalPipe.normalized(min, max, smooth)", "Common pipe: normalize, clamp to 0..1 and smooth."],
  ["signalPipe.clamped(smooth)", "Common pipe: clamp to 0..1 and smooth."],
  ["signalPipe.smooth(amount)", "Common pipe: smooth only."],
  ["signalPipe.zero() / constant(value)", "Common pipes for fixed outputs."],
  ["signalPipe.beat(threshold, pulse, decay)", "Common pipe: threshold, pulse and decay."],
  ["signalPipe.raw()", "Passes the signal through unchanged."],
  ["clamp(value, min, max)", "Low-level rule helper: restricts a number to a range."],
  ["read(values, name) / readOr(values, name, fallback)", "Low-level rule helpers for numeric source snapshots."],
  ["previousValues(history)", "Reads the latest value snapshot from a history buffer."],
  ["scoreFromFactors(initial, factors, context)", "Combines named scoring factors and clamps the result."],
  ["collectRisks(groups, context)", "Collects labels from matching grouped rules."],
  ["createBaseHealth(system, score, risks, metrics)", "Creates a normalized scored-state descriptor for custom interpretation layers."],
  ["createHealthInterpreter(options)", "Adds history, trend detection, hysteresis, recovering/unstable transitions and intensity to domain base scores."],
  ["signal.map(fn)", "Custom value transform."],
  ["signal.clamp(min, max)", "Restricts values to a range."],
  ["signal.normalize(min, max)", "Maps a range into 0..1."],
  ["signal.smooth(amount)", "Interpolates toward the current value."],
  ["signal.decay(amount)", "Rises immediately and falls gradually."],
  ["signal.threshold(limit)", "Outputs 1 above a threshold, otherwise 0."],
  ["signal.pulse(duration)", "Emits a short pulse when input turns on."],
  ["signal.bind(fn)", "Runs a binding function every tick."],
  ["DOM bindings", "bindCSSVar, bindStyle, bindClass, bindAttribute."],
  ["Target bindings", "bindTarget, bindTargetProps, spawnTarget."],
  ["WAAPI bindings", "bindAnimationProgress, bindPlaybackRate, playAnimationOnPulse."],
  ["Network sources", "Map WebSocket or SSE payload paths to named sources."],
  ["Event sources", "Pointer, click, scroll, visibility, motion and orientation signals."]
]

const signalNames = [
  ["audio()", "Use audioSignals from @latido/audio/signals, or signals.audio from @latido/web"],
  ["events()", "Use eventSignals from @latido/events/signals, or signals.event from @latido/web"],
  ["network()", "Whatever names you define in the sources config, for example feed.energy"],
  ["latido.source()", "Whatever name you register, for example system.healthScore"],
  ["catalog only", "Import from the plugin subpath, for example @latido/audio/signals, or from @latido/web/signals for the aggregate catalog"]
]

renderPackages()
renderExamples()
renderRecipes()
renderApi()
renderSignalNames()
resolveBaseLinks()
trackActiveNavigation()

function renderPackages() {
  const root = document.querySelector("[data-package-grid]")
  root.innerHTML = packages.map(item => `
    <article class="card">
      <h3>${item.name}</h3>
      <p>${item.summary}</p>
      <p class="muted">${item.use}</p>
      <code>${item.install}</code>
      <pre><code>${escapeHtml(item.code)}</code></pre>
    </article>
  `).join("")
}

function renderExamples() {
  const root = document.querySelector("[data-example-grid]")
  root.innerHTML = examples.map(item => `
    <article class="card example-card">
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <dl>
        <div><dt>Signals</dt><dd>${item.signals}</dd></div>
        <div><dt>Targets</dt><dd>${item.targets}</dd></div>
      </dl>
      <div class="card-actions">
        <a href="${resolvePath(item.live)}">Live example</a>
        <a href="${repo}/blob/main/${item.source}">Source code</a>
      </div>
    </article>
  `).join("")
}

function renderRecipes() {
  const root = document.querySelector("[data-recipe-list]")
  root.innerHTML = recipes.map(item => `
    <article id="${item.id}" class="recipe">
      <div>
        <h3>${item.title}</h3>
        <p class="recipe-needs">${escapeHtml(item.needs)}</p>
      </div>
      <pre><code>${escapeHtml(item.code)}</code></pre>
    </article>
  `).join("")
}

function renderApi() {
  const root = document.querySelector("[data-api-grid]")
  root.innerHTML = `
    <article class="api-note">
      <h3>Signal names are source names</h3>
      <p>
        <code>latido.signal(signals.audio.energy)</code> works because <code>audio()</code>
        registered <code>audio.energy</code>. Each plugin owns its own catalog, like
        <code>audioSignals</code> from <code>@latido/audio/signals</code>. The
        <code>@latido/web</code> package reexports an aggregate <code>signals</code> catalog
        for common browser projects. Custom names still come from
        <code>latido.source("my.name", reader)</code>.
      </p>
    </article>
    ${api.map(([name, description]) => `
    <article>
      <code>${name}</code>
      <p>${description}</p>
    </article>
  `).join("")}`
}

function renderSignalNames() {
  const root = document.querySelector("[data-signal-name-list]")
  if (!root) return

  root.innerHTML = signalNames.map(([provider, names]) => `
    <div>
      <dt>${provider}</dt>
      <dd>${names}</dd>
    </div>
  `).join("")
}

function resolveBaseLinks() {
  for (const link of document.querySelectorAll("[data-page-link]")) {
    link.href = resolvePath(link.dataset.pageLink)
  }
}

function resolvePath(path) {
  if (path.startsWith("#") || path.startsWith("http")) return path

  if (import.meta.env.DEV && path.startsWith("examples/")) {
    return `${localExampleOrigin}/${path.slice("examples/".length)}`
  }

  if (import.meta.env.DEV && path.startsWith("system-pulse/")) {
    return `${localSystemPulseOrigin}/`
  }

  return `${base}${path}`.replace(/([^:]\/)\/+/g, "$1")
}

function redirectDevFallbackRoutes() {
  if (!import.meta.env.DEV) return

  if (location.pathname.startsWith("/examples/")) {
    location.replace(`${localExampleOrigin}/${location.pathname.slice("/examples/".length)}${location.hash}`)
    return
  }

  if (location.pathname.startsWith("/system-pulse")) {
    location.replace(`${localSystemPulseOrigin}/${location.hash}`)
  }
}

function trackActiveNavigation() {
  const links = Array.from(document.querySelectorAll(".nav a"))
  const sections = links
    .map(link => document.querySelector(link.getAttribute("href")))
    .filter(Boolean)

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      .at(0)

    if (!visible) return

    for (const link of links) {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`)
    }
  }, { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.25, 0.5] })

  for (const section of sections) observer.observe(section)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
