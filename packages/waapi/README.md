# @latido/waapi

Web Animations API bindings for Latido.

## Usage

```js
import { createLatido } from "@latido/core"
import { waapi } from "@latido/waapi"

const animation = element.animate(keyframes, { duration: 600, fill: "both" })
const latido = createLatido().use(waapi())

latido.signal("audio.energy")
  .bindAnimationProgress(animation)

latido.signal("audio.beat")
  .playAnimationOnPulse(animation)

latido.start()
```
