export { audioSignals } from "@latido/audio/signals"
export { eventSignals } from "@latido/events/signals"

import { audioSignals } from "@latido/audio/signals"
import { eventSignals } from "@latido/events/signals"

export const signals = Object.freeze({
  audio: audioSignals,
  event: eventSignals
})
