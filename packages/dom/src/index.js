/**
 * Creates the Latido DOM plugin.
 *
 * @returns {(latido: import("@latido/core").createLatido) => void}
 */
export function dom() {
  return latido => {
    latido.extendSignal("bindCSSVar", (signal, target, varName, mapper = defaultMapper) => {
      const elements = resolveElements(target)

      return signal.bind(value => {
        const next = mapper(value)
        for (const element of elements) {
          element.style.setProperty(varName, String(next))
        }
      })
    })

    latido.extendSignal("bindStyle", (signal, target, styleName, mapper = defaultMapper) => {
      const elements = resolveElements(target)

      return signal.bind(value => {
        const next = mapper(value)
        for (const element of elements) {
          element.style[styleName] = String(next)
        }
      })
    })

    latido.extendSignal("bindClass", (signal, target, className, predicate = value => value > 0) => {
      const elements = resolveElements(target)

      return signal.bind(value => {
        const enabled = Boolean(predicate(value))
        for (const element of elements) {
          element.classList.toggle(className, enabled)
        }
      })
    })

    latido.extendSignal("bindAttribute", (signal, target, attributeName, mapper = defaultMapper) => {
      const elements = resolveElements(target)

      return signal.bind(value => {
        const next = mapper(value)
        for (const element of elements) {
          if (next === false || next === null || next === undefined) {
            element.removeAttribute(attributeName)
          } else {
            element.setAttribute(attributeName, String(next))
          }
        }
      })
    })
  }
}

export {
  defineLatidoElements,
  defineLatidoPulseCore,
  defineLatidoPulseField,
  defineLatidoSignalReadout,
  LatidoPulseCore,
  LatidoPulseField,
  LatidoSignalReadout
} from "./components/index.js"

/**
 * Resolves a selector, element, or element array once.
 *
 * @param {string | Element | Element[]} target
 * @returns {Element[]}
 */
function resolveElements(target) {
  if (typeof target === "string") {
    return Array.from(document.querySelectorAll(target))
  }

  if (Array.isArray(target)) {
    return target.filter(Boolean)
  }

  return target ? [target] : []
}

function defaultMapper(value) {
  return value
}
