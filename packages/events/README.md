# @latido/events

Browser event sources for Latido.

[Documentation](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Usage

```js
import { createLatido } from "@latido/core"
import { events, eventSignals } from "@latido/events"

const latido = createLatido().use(events())

latido.signal(eventSignals.pointerProgressX)
  .bind(value => {
    element.style.setProperty("--x", value)
  })

latido.signal(eventSignals.clickPulse)
  .pulse(160)
  .bind(value => {
    element.style.setProperty("--click", value)
  })

latido.start()
```

Sources include pointer position, pointer down state, click pulses, scroll progress, document visibility, device motion, and device orientation.

`@latido/events` exports `eventSignals` so editors can autocomplete source names:

```js
import { eventSignals } from "@latido/events/signals"

latido.signal(eventSignals.clickPulse)
latido.signal(eventSignals.pointerProgressX)
```

Motion and orientation sources are normalized:

```txt
event.motion.x
event.motion.y
event.motion.z
event.orientation.alpha
event.orientation.beta
event.orientation.gamma
```
