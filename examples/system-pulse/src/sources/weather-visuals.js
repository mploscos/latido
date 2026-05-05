/**
 * Derives perceptual weather signals from raw weather data.
 *
 * These values are not extra data sources. They are interpretation signals used
 * to drive movement, irregularity and wind deformation in the perceptual view.
 *
 * @param {object} values Current weather values indexed by Latido source name.
 * @returns {Record<string, number>}
 */
export function deriveWeatherVisuals(values) {
  const wind = read(values, "weather.wind")
  const windDirection = read(values, "weather.windDirection")
  const windGusts = read(values, "weather.windGusts")
  const pressure = read(values, "weather.pressure")
  const precipitation = read(values, "weather.precipitation")
  const rain = read(values, "weather.rain")
  const showers = read(values, "weather.showers")
  const snowfall = read(values, "weather.snowfall")
  const cloudCover = read(values, "weather.cloudCover")
  const weatherCode = read(values, "weather.weatherCode")
  const conditionStress = weatherConditionStress(weatherCode)
  const pressureStress = clamp((Math.abs(pressure - 1013) - 10) / 35)
  const windForce = clamp(wind / 30 * 0.45 + windGusts / 45 * 0.55)
  const windRadians = windDirection * Math.PI / 180
  const windX = -Math.sin(windRadians) * windForce
  const windY = Math.cos(windRadians) * windForce

  return {
    "weather.visualEnergy": clamp(wind / 38 * 0.4 + windGusts / 52 * 0.34 + precipitation / 9 * 0.18 + snowfall / 5 * 0.18),
    "weather.visualFlow": clamp(wind / 28 * 0.35 + windGusts / 42 * 0.45 + showers / 7 * 0.2),
    "weather.visualIrregularity": clamp(pressureStress * 0.28 + windGusts / 80 * 0.2 + rain / 8 * 0.18 + showers / 7 * 0.26 + snowfall / 5 * 0.18 + cloudCover / 100 * 0.1 + conditionStress * 0.34),
    "weather.visualBeat": clamp(precipitation / 5 * 0.36 + rain / 6 * 0.22 + showers / 4 * 0.36 + snowfall / 2.5 * 0.42 + conditionStress * 0.34),
    "weather.visualWindX": windX,
    "weather.visualWindY": windY,
    "weather.visualWindAngle": Math.atan2(windY, windX) * 180 / Math.PI
  }
}

function weatherConditionStress(weatherCode) {
  if (weatherCode >= 95) return 0.9
  if (weatherCode >= 80) return 0.48
  if (weatherCode >= 71) return 0.42
  if (weatherCode >= 61) return 0.28
  return 0
}

function read(values, name) {
  const number = Number(values?.[name])
  return Number.isFinite(number) ? number : 0
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}
