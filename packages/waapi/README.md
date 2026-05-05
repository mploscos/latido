# @latido/waapi

Web Animations API bindings for Latido.

[Documentation](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Usage

```js
import { createLatido } from "@latido/core"
import { audio, audioSignals } from "@latido/audio"
import { waapi } from "@latido/waapi"

const animation = element.animate(keyframes, { duration: 600, fill: "both" })
const latido = createLatido()
  .use(audio({ element: audioEl }))
  .use(waapi())

latido.signal(audioSignals.energy)
  .bindAnimationProgress(animation)

latido.signal(audioSignals.beat)
  .playAnimationOnPulse(animation)

latido.start()
```
