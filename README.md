# Latido

> Turn signals into living interfaces.

Latido is a renderer-agnostic rhythm-driven UI engine for the web.

![Latido demo](./assets/demo.gif)

Bind audio, telemetry, or any temporal signal to CSS, DOM, and future renderers.

Latido does not transport data, render full scenes, or store application state. It converts temporal signals into visual bindings such as CSS variables, DOM styles, attributes, and classes.

▶️ [Live demo](https://mploscos.github.io/latido/)  
Audio starts after pressing **Play**.

## Philosophy

- Turn signals into living interfaces
- Make UIs react to rhythm, not just clicks
- Keep the core minimal, intuitive, and extensible
- Audio is just the first plugin, not the focus

## Basic Example

```js
import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"
import { audio } from "@latido/audio"

const latido = createLatido()
  .use(dom())
  .use(audio({ element: document.querySelector("audio") }))

latido.signal("audio.energy")
  .smooth(0.15)
  .bindCSSVar(document.body, "--energy")

latido.signal("audio.beat")
  .decay(0.2)
  .bindStyle(".beat-button", "transform", v => `scale(${1 + v * 0.12})`)

latido.signal("audio.bass")
  .smooth(0.1)
  .bindCSSVar(".bar-bass", "--level")

latido.start()
```

Signals do not need to come from audio:

```js
latido.source("scroll.progress", () => window.scrollY)

latido.signal("scroll.progress")
  .normalize(0, 800)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--scroll")
```

## Plugin System

Plugins are functions that receive a Latido instance. They use the same small public API as application code:

- `latido.source(name, reader)` registers temporal values
- `latido.extendSignal(name, handler)` adds chainable signal methods to that Latido instance
- `latido.control(name, fn)` exposes small plugin controls, such as `play()` and `pause()`

```js
function plugin() {
  return latido => {
    latido.source("custom.value", () => Math.random())

    latido.extendSignal("log", signal => {
      return signal.bind(value => console.log(value))
    })
  }
}
```

Signal extensions are scoped to the instance that installs the plugin. Installing `dom()` on one Latido engine does not add DOM binding methods to unrelated engines.

The first packages are:

- `@latido/core`: scheduler, sources, signals, transforms, plugin hook
- `@latido/dom`: CSS variables, styles, attributes, and classes
- `@latido/audio`: Web Audio sources for energy, bands, and simple beat detection

## Signal Pipeline

Latido follows a small pipeline:

```text
source -> signal -> transform -> binding -> target
```

Sources produce numeric values over time. Signals read those values, chain transforms, and push the result into bindings on every animation frame.

Each call to `latido.signal(name)` creates a new independent signal pipeline. Multiple pipelines can consume the same source.

## Run The Demo

```sh
npm install
npm run dev
```

Open the local Vite URL and use the play button in `examples/basic`.

## Design Principles

- Latido is not a renderer
- Latido is not tied to audio
- Latido is not a framework
- Latido converts signals into visual behavior

## Roadmap

- PixiJS bindings
- Canvas bindings
- WebGPU bindings
- Web Animations API bindings
- WebSocket and SSE sources
- Telemetry and sensor sources
- Timeline and editor tooling

## Audio

Demo audio by Kissan4  
https://pixabay.com/es/users/kissan4-10387284/  
Used under Pixabay License.

## Author

Marcos Pérez  
https://github.com/mploscos