/**
 * Creates the Latido Web Animations API binding plugin.
 *
 * @returns {(latido: import("@latido/core").createLatido) => void}
 */
export function waapi() {
  return latido => {
    latido.extendSignal("bindAnimationProgress", (signal, animation, options = {}) => {
      const {
        duration = getAnimationDuration(animation),
        mapper = defaultMapper,
        clamp = true
      } = options

      animation.pause?.()

      return signal.bind((value, context) => {
        const progress = Number(mapper(value, context)) || 0
        const next = clamp ? clamp01(progress) : progress
        animation.currentTime = next * duration
      })
    })

    latido.extendSignal("bindPlaybackRate", (signal, animation, mapper = defaultMapper) => {
      return signal.bind((value, context) => {
        animation.playbackRate = Number(mapper(value, context)) || 0
      })
    })

    latido.extendSignal("playAnimationOnPulse", (signal, animation, predicate = value => value > 0) => {
      let wasOn = false

      return signal.bind((value, context) => {
        const isOn = Boolean(predicate(value, context))

        if (isOn && !wasOn) {
          animation.cancel?.()
          animation.play?.()
        }

        wasOn = isOn
      })
    })
  }
}

function getAnimationDuration(animation) {
  const timing = animation.effect?.getTiming?.()
  return Number(timing?.duration) || 1000
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function defaultMapper(value) {
  return value
}
