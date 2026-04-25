# @latido/audio

Web Audio sources for Latido.

> Turn audio energy, frequency bands, and beats into UI signals.

![Latido demo](https://raw.githubusercontent.com/mploscos/latido/main/assets/demo.gif)

[Live demo](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Install

```sh
npm install @latido/core @latido/dom @latido/audio
```

## Usage

```js
import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"
import { audio } from "@latido/audio"

const latido = createLatido()
  .use(dom())
  .use(audio({ element: document.querySelector("audio") }))

latido.signal("audio.energy")
  .smooth(0.15)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--energy")

latido.signal("audio.beat")
  .decay(0.2)
  .bindClass(".beat-button", "is-beating", value => value > 0.5)

latido.start()
```

Audio starts after a user gesture. Call `latido.play()` from a button click to satisfy browser autoplay rules.
