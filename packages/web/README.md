# @latido/web

Convenience browser entrypoint for Latido.

[Documentation](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

Use this package when you want the common browser plugins from one import:

```js
import { createLatido, dom, audio } from "@latido/web"

const latido = createLatido()
  .use(dom())
  .use(audio({ element: audioEl }))
```

Signal name helpers from each plugin are reexported for editor autocomplete:

```js
import { signals, signalPipe } from "@latido/web"

signalPipe.clamped(0.1)(latido.signal(signals.audio.energy))
```

Common pipe helpers are also available:

```js
signalPipe.normalized(-4, 36, 0.08)
signalPipe.beat(0.2, 280, 0.1)
```

The same catalog is available without importing browser plugins:

```js
import { signals } from "@latido/web/signals"
```

Individual plugin catalogs remain available from their own packages:

```js
import { audioSignals } from "@latido/audio/signals"
import { eventSignals } from "@latido/events/signals"
```

For fine-grained dependency control, install the individual `@latido/*` packages instead.
