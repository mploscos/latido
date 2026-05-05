const marketBase = {
  price: 5120,
  previousDelta: 0
}

export function fallbackWeather(location, now = Date.now()) {
  const seed = location.seed ?? 0
  const slow = Math.sin(now * 0.000035 + seed)
  const storm = waveGate(Math.sin(now * 0.000025 + seed * 1.6), 0.58)
  const coldFront = waveGate(Math.sin(now * 0.000018 + seed * 2.1), 0.72)
  const showerPulse = waveGate(Math.sin(now * 0.00011 + seed * 2.3), 0.65)
  const wind = Math.max(0, 10 + Math.sin(now * 0.00014 + seed * 1.7) * 9 + storm * 34)
  const windDirection = (180 + Math.sin(now * 0.000022 + seed * 0.7) * 95 + seed * 28 + 360) % 360
  const windGusts = wind + storm * 26 + Math.max(0, Math.sin(now * 0.0002 + seed)) * 8
  const pressure = 1012 + Math.sin(now * 0.00002 + seed) * 16 - storm * 30
  const precipitation = Math.max(0, Math.sin(now * 0.00009 + seed * 2.3) - 0.65) * 2.8 + storm * 8.5
  const temperature = location.baseTemperature + slow * 6 - coldFront * 14
  const snowfall = temperature < 2 ? precipitation * (0.35 + coldFront * 0.65) : 0
  const showers = Math.max(0, showerPulse * 3.5 + storm * 3 - snowfall * 0.4)
  const rain = Math.max(0, precipitation - snowfall - showers * 0.35)
  const cloudCover = Math.min(100, 36 + precipitation * 7 + storm * 42 + coldFront * 16)

  return {
    temperature,
    wind,
    windDirection,
    windGusts,
    pressure,
    precipitation,
    rain,
    showers,
    snowfall,
    cloudCover,
    weatherCode: weatherCodeFor({ storm, precipitation, snowfall, rain, showers, cloudCover })
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

function weatherCodeFor({ storm, precipitation, snowfall, rain, showers, cloudCover }) {
  if (snowfall > 3) return 75
  if (snowfall > 0.2) return 71
  if (storm > 0.65 && precipitation > 3) return 95
  if (showers > 1.5) return 81
  if (rain > 4) return 63
  if (rain > 0.1 || precipitation > 0.1) return 61
  if (cloudCover > 80) return 3
  if (cloudCover > 45) return 2
  return 1
}
