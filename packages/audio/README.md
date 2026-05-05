# @latido/audio

Web Audio sources for Latido.

> Turn audio energy, frequency bands, and beats into UI signals.

![Latido demo](https://raw.githubusercontent.com/mploscos/latido/main/assets/demo.gif)

[Documentation](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Install

```sh
npm install @latido/core @latido/dom @latido/audio
```

## Usage

```js
import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"
import { audio, audioSignals } from "@latido/audio"

const latido = createLatido()
  .use(dom())
  .use(audio({ element: document.querySelector("audio") }))

latido.signal(audioSignals.energy)
  .smooth(0.15)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--energy")

latido.signal(audioSignals.beat)
  .decay(0.2)
  .bindClass(".beat-button", "is-beating", value => value > 0.5)

latido.start()
```

Audio starts after a user gesture. Call `latido.play()` from a button click to satisfy browser autoplay rules.

## Signal names

`@latido/audio` exports `audioSignals` so editors can autocomplete source names:

```js
import { audioSignals } from "@latido/audio/signals"

latido.signal(audioSignals.energy)
latido.signal(audioSignals.beat)
```

## Beat detection

`audio.beat` is a binary onset signal for visual synchronization. It detects short energy changes in the spectrum; it does not estimate musical BPM or bar position.

```js
audio({
  element,
  minBeatInterval: 180,
  beatSensitivity: 1.35,
  energySensitivity: 1.04
})
```

Use lower sensitivity values for denser reactions and higher values for fewer false positives.
