# @latido/core

Core engine for Latido, a renderer-agnostic rhythm-driven UI engine for the web.

> Turn signals into living interfaces.

![Latido demo](https://raw.githubusercontent.com/mploscos/latido/main/assets/demo.gif)

[Live demo](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Install

```sh
npm install @latido/core
```

## Usage

```js
import { createLatido } from "@latido/core"

const latido = createLatido()

latido.source("scroll.progress", () => window.scrollY)

latido.signal("scroll.progress")
  .normalize(0, 800)
  .clamp(0, 1)
  .bind(value => {
    document.body.style.setProperty("--scroll", value)
  })

latido.start()
```

Latido core provides the scheduler, sources, signals, transforms, and plugin API. It does not render scenes, store application state, or transport data.

## Adapters

Adapters translate domain-specific data into a stable signal contract. This lets an interface keep the same bindings while swapping audio, browser events, weather, biology, or any other source domain.

```js
const latido = createLatido().adapt("hmi", {
  initial: "weather",
  adapters: {
    weather: {
      label: "Weather",
      read(context) {
        return {
          energy: 0.7,
          pulse: 0,
          flow: 0.4,
          volatility: 0.2,
          phase: context.time * 0.00004,
          primary: 0.6,
          secondary: 0.5,
          tertiary: 0.1
        }
      }
    },
    biology: {
      label: "Biology",
      read() {
        return {
          energy: 0.8,
          pulse: 1,
          flow: 0.6,
          volatility: 0.15,
          phase: 0,
          primary: 0.7,
          secondary: 0.65,
          tertiary: 0.8
        }
      }
    }
  }
})

latido.signal("hmi.energy").bind(value => {
  document.body.style.setProperty("--energy", value)
})

latido.useAdapter("hmi", "biology")
```

By default, adapter values are clamped to `0..1`, and `phase` wraps around `0..1`.
