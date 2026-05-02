import { defineLatidoPulseCore } from "./pulse-core.js"
import { defineLatidoPulseField } from "./pulse-field.js"
import { defineLatidoSignalReadout } from "./signal-readout.js"

export { defineLatidoPulseCore, LatidoPulseCore } from "./pulse-core.js"
export { defineLatidoPulseField, LatidoPulseField } from "./pulse-field.js"
export { defineLatidoSignalReadout, LatidoSignalReadout } from "./signal-readout.js"

export function defineLatidoElements() {
  defineLatidoPulseCore()
  defineLatidoPulseField()
  defineLatidoSignalReadout()
}
