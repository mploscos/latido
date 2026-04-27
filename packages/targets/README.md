# @latido/targets

Renderer-agnostic target bindings for Latido signals.

> Connect Latido signals to arbitrary object-based renderers with object paths and spawn lifecycles.

![Latido demo](https://raw.githubusercontent.com/mploscos/latido/main/assets/demo.gif)

[Live demo](https://mploscos.github.io/latido/) · [GitHub](https://github.com/mploscos/latido)

## Install

```sh
npm install @latido/core @latido/targets
```

## Usage

```js
import { createLatido } from "@latido/core"
import { targets } from "@latido/targets"

const latido = createLatido().use(targets())

latido.signal("audio.energy")
  .bindTarget(sprite, "scale", v => 1 + v * 0.5)

latido.signal("audio.beat")
  .spawnTarget(() => createRing(), { lifeMs: 900 })

latido.start()
```

`@latido/targets` connects Latido signals to arbitrary object-based renderers. PixiJS display objects, Three.js meshes, Canvas state objects, filter objects, uniforms, and custom renderers can all use the same binding model.

Latido does not render. Your renderer owns its scene, render loop, lifecycle, and resources. This package only writes signal values into target object paths.

## API

### `targets(options?)`

```js
const latido = createLatido().use(targets())
```

Options:

- `container`: optional default container used by `spawnTarget`.

### `bindTarget(target, property, mapper?)`

```js
latido.signal("audio.energy")
  .bindTarget(sprite, "alpha", v => 0.4 + v * 0.6)

latido.signal("audio.bass")
  .bindTarget(sprite, "scale", v => 1 + v * 0.5)

latido.signal("audio.treble")
  .bindTarget(material, "uniforms.intensity.value")
```

`property` is an object path. Simple paths such as `x`, `y`, `alpha`, `rotation`, and `tint` work, and dotted paths such as `scale.x`, `position.y`, or `material.uniforms.strength` work too.

When a target property is point-like, values can be a number, `[x, y]`, or `{ x, y }`.

### `bindTargetProps(target, props)`

```js
latido.signal("audio.energy")
  .bindTargetProps(sprite, {
    alpha: v => 0.5 + v * 0.5,
    scale: v => 1 + v * 0.4,
    tint: v => v > 0.7 ? 0xffffff : 0xff3d81
  })
```

### `spawnTarget(factory, options?)`

```js
latido.signal("audio.beat")
  .pulse(120)
  .spawnTarget(() => createRing(), {
    lifeMs: 900,
    update: (ring, age, progress) => {
      ring.scale.set(0.2 + progress * 2.5)
      ring.alpha = 1 - progress
    }
  })
```

Options:

- `threshold`: value needed to spawn; default `0.5`.
- `cooldownMs`: minimum time between spawns; default `80`.
- `lifeMs`: object lifetime; default `800`.
- `update`: optional `(object, age, progress, value) => void`.
- `container`: optional renderer container; defaults to `targets({ container })`.
- `removeOnEnd`: removes objects after `lifeMs`; default `true`.
