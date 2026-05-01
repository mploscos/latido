# @latido/events

Browser event sources for Latido.

## Usage

```js
import { createLatido } from "@latido/core"
import { events } from "@latido/events"

const latido = createLatido().use(events())

latido.signal("event.pointer.progressX")
  .bind(value => {
    element.style.setProperty("--x", value)
  })

latido.signal("event.click.pulse")
  .pulse(160)
  .bind(value => {
    element.style.setProperty("--click", value)
  })

latido.start()
```

Sources include pointer position, pointer down state, click pulses, scroll progress, document visibility, device motion, and device orientation.

Motion and orientation sources are normalized:

```txt
event.motion.x
event.motion.y
event.motion.z
event.orientation.alpha
event.orientation.beta
event.orientation.gamma
```
