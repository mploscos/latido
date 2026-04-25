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
