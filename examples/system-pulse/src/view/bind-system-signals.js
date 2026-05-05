/**
 * Connects named Latido sources to view CSS targets.
 *
 * Custom pipes remain plain functions. Helper pipes from `signalPipe` use the
 * same shape, so callers can mix both styles in one binding list.
 *
 * @param {{ signal(name: string): import("@latido/core").Signal }} latido Latido instance.
 * @param {{ setSignal(system: string, name: string, value: number): void }} view Target view adapter.
 * @param {SystemSignalBinding[]} bindings Signal binding descriptors.
 * @returns {void}
 */
export function bindSystemSignals(latido, view, bindings) {
  for (const binding of bindings) {
    const signal = binding.pipe(latido.signal(binding.source))
    signal.bind(value => view.setSignal(binding.system, binding.target, value))
  }
}

/**
 * @typedef {object} SystemSignalBinding
 * @property {string} system System namespace shown by the view.
 * @property {string} source Latido source name.
 * @property {string} target CSS variable name without the leading `--`.
 * @property {(signal: import("@latido/core").Signal) => import("@latido/core").Signal} pipe Signal transform pipe.
 */
