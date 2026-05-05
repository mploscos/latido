/**
 * Common signal pipeline helpers.
 *
 * A signal pipe is a small function that receives a Latido Signal and returns
 * the same signal after applying transforms.
 *
 * @typedef {import("./index.js").Signal} Signal
 * @typedef {(source: Signal) => Signal} SignalPipe
 */

/**
 * Helper functions for common Latido signal pipelines.
 */
export const signalPipe = {
  /**
   * Normalizes an input range, clamps it to 0..1 and smooths the result.
   *
   * @param {number} min Input value mapped to 0.
   * @param {number} max Input value mapped to 1.
   * @param {number} [smooth=0.1] Smoothing amount.
   * @returns {SignalPipe}
   */
  normalized(min, max, smooth = 0.1) {
    return source => source
      .normalize(min, max)
      .clamp(0, 1)
      .smooth(smooth)
  },

  /**
   * Clamps a signal to 0..1 and smooths the result.
   *
   * @param {number} [smooth=0.1] Smoothing amount.
   * @returns {SignalPipe}
   */
  clamped(smooth = 0.1) {
    return source => source
      .clamp(0, 1)
      .smooth(smooth)
  },

  /**
   * Smooths a signal without changing its range.
   *
   * @param {number} [amount=0.1] Smoothing amount.
   * @returns {SignalPipe}
   */
  smooth(amount = 0.1) {
    return source => source.smooth(amount)
  },

  /**
   * Maps every input value to 0.
   *
   * @returns {SignalPipe}
   */
  zero() {
    return source => source.map(() => 0)
  },

  /**
   * Converts values above a threshold into short pulses with decay.
   *
   * @param {number} [threshold=0.2] Threshold needed to trigger the pulse.
   * @param {number} [pulse=250] Pulse duration in milliseconds.
   * @param {number} [decay=0.1] Decay amount per frame.
   * @returns {SignalPipe}
   */
  beat(threshold = 0.2, pulse = 250, decay = 0.1) {
    return source => source
      .threshold(threshold)
      .pulse(pulse)
      .decay(decay)
  },

  /**
   * Maps every input value to a fixed constant.
   *
   * @param {number} [value=0] Constant output value.
   * @returns {SignalPipe}
   */
  constant(value = 0) {
    return source => source.map(() => value)
  },

  /**
   * Leaves a signal unchanged.
   *
   * @returns {SignalPipe}
   */
  raw() {
    return source => source
  }
}
