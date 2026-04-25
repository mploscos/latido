# @latido/dom

DOM bindings for Latido signals.

> Bind temporal signals to CSS variables, DOM styles, attributes, and classes.

![Latido demo](https://raw.githubusercontent.com/mploscos/latido/main/assets/demo.gif)

[Live demo](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Install

```sh
npm install @latido/core @latido/dom
```

## Usage

```js
import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"

const latido = createLatido().use(dom())

latido.source("scroll.progress", () => window.scrollY)

latido.signal("scroll.progress")
  .normalize(0, 800)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--scroll")

latido.start()
```

This package is a plugin. It adds DOM binding methods to signals without changing Latido core.
