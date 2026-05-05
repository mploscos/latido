# @latido/core

Core engine for Latido, a renderer-agnostic rhythm-driven UI engine for the web.

> Turn signals into living interfaces.

![Latido demo](https://raw.githubusercontent.com/mploscos/latido/main/assets/demo.gif)

[Documentation](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

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

## Simple signal pipes

Most mappings do not need a custom inline pipeline.

```js
import { signalPipe } from "@latido/core"

const pipe = signalPipe.normalized(-4, 36, 0.08)

pipe(latido.signal("weather.temperature"))
  .bind(value => {
    document.body.style.setProperty("--tone", value)
  })
```

`signalPipe` helpers are plain functions that receive a Latido signal and return the transformed signal:

```js
pipe: signalPipe.normalized(-4, 36, 0.08)
pipe: signalPipe.clamped(0.1)
pipe: signalPipe.smooth(0.04)
pipe: signalPipe.zero()
pipe: signalPipe.constant(1)
pipe: signalPipe.beat(0.2, 280, 0.1)
pipe: signalPipe.raw()
```

Custom pipes still work:

```js
pipe: source => source
  .normalize(0, 100)
  .map(value => value * value)
  .smooth(0.1)
```

## Rule Utilities

Core also exports pure helpers for custom interpretation layers. They are generic building blocks; Latido does not ship market, weather or health rules.

```js
import {
  clamp,
  collectRisks,
  createBaseHealth,
  previousValues,
  read,
  readOr,
  scoreFromFactors
} from "@latido/core"
```

- `clamp(value, min, max)`: restricts a number to a range.
- `read(values, name)`: reads a finite number or returns `0`.
- `readOr(values, name, fallback)`: reads a finite number or returns a fallback.
- `previousValues(history)`: returns the latest value snapshot from a history buffer.
- `scoreFromFactors(initial, factors, context)`: combines named scoring factors and clamps the result.
- `collectRisks(groups, context)`: collects labels from matching grouped rules.
- `createBaseHealth(system, score, risks, metrics)`: creates a normalized scored-state descriptor.

## Health Interpreter

`createHealthInterpreter` turns domain base scores into temporal states. It handles history, trend detection, instability trend detection, hysteresis, minimum state duration, recovering/unstable transitions and intensity. Your app still owns domain-specific scoring and text.

```js
import { createHealthInterpreter } from "@latido/core"

const interpretHealth = createHealthInterpreter({
  deriveBase(system, values, history) {
    return deriveWeatherBase(values, history)
  },
  reasonFor(state, base, temporal) {
    if (state === "recovering") return "Recovering after sustained weather stress"
    if (base.domainRisks.includes("high wind")) return "High wind and precipitation"
    return "Stable conditions"
  }
})

const health = interpretHealth("weather", values, history)
```

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
