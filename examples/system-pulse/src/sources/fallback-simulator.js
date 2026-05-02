const marketBase = {
  price: 5120,
  previousDelta: 0
}

export function fallbackWeather(location, now = Date.now()) {
  const seed = location.seed ?? 0
  const slow = Math.sin(now * 0.000035 + seed)
  const storm = waveGate(Math.sin(now * 0.000025 + seed * 1.6), 0.58)
  const wind = Math.max(0, 10 + Math.sin(now * 0.00014 + seed * 1.7) * 9 + storm * 34)
  const pressure = 1012 + Math.sin(now * 0.00002 + seed) * 16 - storm * 30

  return {
    temperature: location.baseTemperature + slow * 6,
    wind,
    pressure,
    precipitation: Math.max(0, Math.sin(now * 0.00009 + seed * 2.3) - 0.65) * 2.8 + storm * 8.5
  }
}

export function fallbackMarket(now = Date.now()) {
  const cycle = Math.sin(now * 0.00006)
  const pulse = Math.sin(now * 0.00041)
  const selloff = waveGate(Math.sin(now * 0.000028), 0.62)
  const rebound = waveGate(Math.sin(now * 0.000028 - 1.1), 0.68)
  const delta = cycle * 0.55 + pulse * 0.22 - selloff * 1.55 + rebound * 0.9
  const volatility = Math.abs(delta - marketBase.previousDelta) * 2.4 + Math.abs(Math.sin(now * 0.00013)) * 0.8 + selloff * 1.05
  marketBase.previousDelta = delta
  marketBase.price *= 1 + delta / 1000

  return {
    price: marketBase.price,
    delta,
    volume: 0.65 + Math.abs(pulse) * 0.5 + Math.abs(delta) * 0.25 + selloff * 0.25,
    volatility,
    beat: Math.abs(delta) > 0.62 || volatility > 1.25 ? 1 : 0
  }
}

function waveGate(value, threshold) {
  return Math.max(0, (value - threshold) / (1 - threshold))
}
