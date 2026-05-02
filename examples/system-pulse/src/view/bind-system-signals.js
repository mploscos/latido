export function bindSystemSignals(latido, view, bindings) {
  for (const binding of bindings) {
    const signal = binding.pipe(latido.signal(binding.source))
    signal.bind(value => view.setSignal(binding.system, binding.target, value))
  }
}
