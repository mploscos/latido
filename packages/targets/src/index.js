/**
 * Creates the Latido target binding plugin.
 *
 * @param {object} [options]
 * @param {object} [options.container] Default container used by spawnTarget.
 * @returns {(latido: import("@latido/core").createLatido) => void}
 */
export function targets(options = {}) {
  const { container: defaultContainer } = options

  return latido => {
    latido.extendSignal("bindTarget", (signal, target, property, mapper = defaultMapper) => {
      const targets = resolveTargets(target)

      return signal.bind((value, context) => {
        const next = mapper(value, context)
        for (const object of targets) {
          setPath(object, property, next)
        }
      })
    })

    latido.extendSignal("bindTargetProps", (signal, target, props) => {
      const targets = resolveTargets(target)
      const entries = Object.entries(props ?? {})

      return signal.bind((value, context) => {
        for (const [property, mapper] of entries) {
          const next = typeof mapper === "function" ? mapper(value, context) : mapper
          for (const object of targets) {
            setPath(object, property, next)
          }
        }
      })
    })

    latido.extendSignal("spawnTarget", (signal, factory, spawnOptions = {}) => {
      const {
        threshold = 0.5,
        cooldownMs = 80,
        lifeMs = 800,
        update,
        container = defaultContainer,
        removeOnEnd = true
      } = spawnOptions

      const active = []
      let lastSpawnTime = -Infinity

      return signal.bind((value, context) => {
        const now = context.time
        const shouldSpawn = value > threshold && now - lastSpawnTime >= cooldownMs

        if (shouldSpawn) {
          const object = factory(value, context)
          lastSpawnTime = now

          if (object) {
            container?.addChild?.(object)
            active.push({ object, startTime: now, value })
          }
        }

        for (let index = active.length - 1; index >= 0; index -= 1) {
          const item = active[index]
          const age = now - item.startTime
          const progress = lifeMs <= 0 ? 1 : Math.min(1, age / lifeMs)

          update?.(item.object, age, progress, value)

          if (progress >= 1) {
            if (removeOnEnd) {
              const parent = item.object.parent
              if (parent) {
                parent.removeChild?.(item.object)
              } else {
                container?.removeChild?.(item.object)
              }
            }

            active.splice(index, 1)
          }
        }
      })
    })
  }
}

function resolveTargets(target) {
  if (Array.isArray(target)) {
    return target.filter(Boolean)
  }

  return target ? [target] : []
}

function setPath(target, property, value) {
  if (!target || !property) return

  const path = String(property).split(".").filter(Boolean)
  if (path.length === 0) return

  if (path.length === 1) {
    setValue(target, path[0], value)
    return
  }

  const key = path.at(-1)
  const owner = path.slice(0, -1).reduce((object, part) => object?.[part], target)

  if (owner && key) {
    setValue(owner, key, value)
  }
}

function setValue(target, property, value) {
  const current = target[property]

  if (isPointLike(current) && isPointValue(value)) {
    setPoint(current, value)
    return
  }

  target[property] = value
}

function isPointLike(value) {
  return Boolean(value && typeof value === "object" && ("x" in value || "y" in value || "z" in value || typeof value.set === "function"))
}

function isPointValue(value) {
  return typeof value === "number" || Array.isArray(value) || Boolean(value && typeof value === "object")
}

function setPoint(point, value) {
  if (typeof value === "number") {
    setPointXYZ(point, value, value, value, "z" in point)
    return
  }

  if (Array.isArray(value)) {
    setPointXYZ(point, value[0], value[1] ?? value[0], value[2], value.length >= 3)
    return
  }

  const hasZ = Object.prototype.hasOwnProperty.call(value, "z")

  setPointXYZ(
    point,
    value.x ?? point.x ?? 0,
    value.y ?? point.y ?? value.x ?? 0,
    value.z,
    hasZ
  )
}

function setPointXYZ(point, x, y, z, hasZ = false) {
  const nextX = Number(x) || 0
  const nextY = Number(y) || 0
  const nextZ = hasZ ? Number(z) || 0 : undefined

  if (typeof point.set === "function" && (hasZ || !("z" in point))) {
    if (hasZ) {
      point.set(nextX, nextY, nextZ)
    } else {
      point.set(nextX, nextY)
    }
    return
  }

  point.x = nextX
  point.y = nextY
  if (hasZ) {
    point.z = nextZ
  }
}

function defaultMapper(value) {
  return value
}
