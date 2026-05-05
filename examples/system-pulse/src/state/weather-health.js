import {
  clamp,
  collectRisks,
  createBaseHealth,
  previousValues,
  read,
  readOr
} from "@latido/core"

const weatherRiskGroups = [
  {
    name: "temperature",
    rules: [
      ["temperature stress", ({ temperaturePenalty }) => temperaturePenalty > 0.45]
    ]
  },
  {
    name: "wind",
    firstMatch: true,
    rules: [
      ["severe gusts", ({ windGusts }) => windGusts > 62],
      ["strong gusts", ({ windGusts }) => windGusts > 45],
      ["high wind", ({ wind }) => wind > 30],
      ["wind", ({ wind }) => wind > 20]
    ]
  },
  {
    name: "precipitation",
    firstMatch: true,
    rules: [
      ["snowfall", ({ snowfall }) => snowfall > 0.2],
      ["heavy showers", ({ showers }) => showers > 3],
      ["heavy rain", ({ rain, precipitation }) => rain > 4 || precipitation > 6],
      ["precipitation", ({ precipitation }) => precipitation > 2],
      ["light precipitation", ({ precipitation }) => precipitation > 0]
    ]
  },
  {
    name: "condition",
    firstMatch: true,
    rules: [
      ["thunderstorm conditions", ({ weatherCode }) => weatherCode >= 95],
      ["snow shower conditions", ({ weatherCode }) => weatherCode >= 85 && weatherCode <= 86],
      ["snow conditions", ({ weatherCode }) => weatherCode >= 71 && weatherCode <= 77],
      ["shower conditions", ({ weatherCode }) => weatherCode >= 80 && weatherCode <= 82],
      ["fog", ({ weatherCode }) => weatherCode === 45 || weatherCode === 48],
      ["heavy cloud cover", ({ cloudCover }) => cloudCover > 88]
    ]
  },
  {
    name: "pressure",
    rules: [
      ["pressure instability", ({ pressureShift }) => pressureShift > 2],
      ["pressure rising", ({ pressureDelta }) => pressureDelta > 1.4],
      ["pressure dropping", ({ pressureDelta }) => pressureDelta < -1.4]
    ]
  },
  {
    name: "recovery",
    rules: [
      ["wind easing", ({ wind, previousWind }) => wind < previousWind - 1.2],
      ["precipitation easing", ({ precipitation, previousPrecipitation }) => precipitation < previousPrecipitation - 0.15],
      ["calm weather", ({ calm }) => calm]
    ]
  }
]

/**
 * Derives weather base health from current weather values.
 *
 * @param {object} values Current source values.
 * @param {Array<object>} history Health history.
 * @returns {object}
 */
export function deriveWeatherBase(values, history) {
  const temperature = read(values, "weather.temperature")
  const wind = read(values, "weather.wind")
  const windGusts = read(values, "weather.windGusts")
  const pressure = read(values, "weather.pressure")
  const precipitation = read(values, "weather.precipitation")
  const rain = read(values, "weather.rain")
  const showers = read(values, "weather.showers")
  const snowfall = read(values, "weather.snowfall")
  const cloudCover = read(values, "weather.cloudCover")
  const weatherCode = read(values, "weather.weatherCode")
  const previous = previousValues(history)
  const previousPressure = readOr(previous, "weather.pressure", pressure)
  const previousWind = readOr(previous, "weather.wind", wind)
  const previousPrecipitation = readOr(previous, "weather.precipitation", precipitation)
  const pressureDelta = pressure - previousPressure
  const pressureShift = Math.abs(pressureDelta)
  const temperaturePenalty = temperature < 15
    ? clamp((15 - temperature) / 20)
    : temperature > 25
      ? clamp((temperature - 25) / 20)
      : 0
  const windPenalty = clamp((wind - 20) / 35)
  const gustPenalty = clamp((windGusts - 38) / 34)
  const precipitationPenalty = clamp((precipitation + rain * 0.55 + showers * 0.7 + snowfall * 1.25) / 10)
  const conditionPenalty = weatherConditionPenalty(weatherCode)
  const cloudPenalty = clamp((cloudCover - 86) / 14) * 0.04
  const pressureStabilityPenalty = clamp(pressureShift / 7)
  const pressureRangePenalty = clamp((Math.abs(pressure - 1013) - 22) / 35)
  const context = {
    temperature,
    wind,
    windGusts,
    precipitation,
    rain,
    showers,
    snowfall,
    cloudCover,
    weatherCode,
    pressureDelta,
    pressureShift,
    previousWind,
    previousPrecipitation,
    temperaturePenalty
  }
  const instability = clamp(
    windPenalty * 0.35 +
    precipitationPenalty * 0.3 +
    gustPenalty * 0.18 +
    conditionPenalty * 0.2 +
    pressureStabilityPenalty * 0.25 +
    temperaturePenalty * 0.1
  )
  const baseScore = clamp(
    0.98 -
    temperaturePenalty * 0.32 -
    windPenalty * 0.26 -
    gustPenalty * 0.14 -
    precipitationPenalty * 0.26 -
    conditionPenalty * 0.2 -
    cloudPenalty -
    pressureStabilityPenalty * 0.14 -
    pressureRangePenalty * 0.06
  )
  const calm = temperaturePenalty === 0 && wind < 12 && windGusts < 22 && precipitation === 0 && snowfall === 0 && pressureShift < 0.8
  const domainRisks = collectRisks(weatherRiskGroups, { ...context, calm })

  return createBaseHealth("weather", baseScore, domainRisks, {
    temperature,
    wind,
    windGusts,
    precipitation,
    rain,
    showers,
    snowfall,
    cloudCover,
    weatherCode,
    instability,
    pressureDelta,
    pressureShift,
    calm,
    stressEvidence: windPenalty + gustPenalty + precipitationPenalty + conditionPenalty + pressureStabilityPenalty + temperaturePenalty,
    severeEvidence: clamp((wind - 42) / 20) +
      clamp((windGusts - 60) / 24) +
      clamp((precipitation - 7) / 8) +
      clamp((snowfall - 3) / 5) +
      clamp((conditionPenalty - 0.6) / 0.35) +
      clamp((temperaturePenalty - 0.65) / 0.35)
  })
}

/**
 * Explains the interpreted weather health state.
 *
 * @param {string} state Final health state.
 * @param {object} baseHealth Domain base health.
 * @param {object} temporal Temporal context.
 * @returns {string}
 */
export function reasonWeatherHealth(state, baseHealth, temporal) {
  const risks = new Set(baseHealth.domainRisks)

  if (state === "recovering") return recoveringWeatherReason(baseHealth, temporal)
  if (state === "unstable") return "Recovery failing, weather instability rising"
  if (state === "stable") return "Stable conditions with calm weather"
  if (risks.has("thunderstorm conditions")) return "Thunderstorm conditions"
  if (risks.has("severe gusts") && (risks.has("heavy rain") || risks.has("heavy showers"))) {
    return "Severe gusts with heavy precipitation"
  }
  if (risks.has("strong gusts")) return "Wind gusts increasing weather stress"
  if (risks.has("heavy rain") || risks.has("heavy showers")) return "Heavy precipitation"
  if (risks.has("snowfall") || risks.has("snow conditions") || risks.has("snow shower conditions")) return "Snowfall affecting the system"
  if (risks.has("high wind") && (risks.has("precipitation") || risks.has("light precipitation"))) {
    return "High wind and precipitation"
  }
  if (risks.has("pressure dropping") && temporal.trend === "worsening") return "Pressure dropping over time"
  if (risks.has("pressure instability") && temporal.trend === "worsening") return "Pressure becoming unstable"
  if (risks.has("temperature stress")) return "Temperature outside comfort range"
  if (state === "stressed") return "Weather stress is persisting"
  if (state === "sick") return "Extreme weather pressure is sustained"
  if (state === "thriving") return "Comfortable weather and stable pressure"
  return "Calm weather conditions"
}

function recoveringWeatherReason(baseHealth, temporal) {
  const risks = new Set([...baseHealth.domainRisks, ...temporal.recentBadRisks])

  if (risks.has("pressure dropping") || risks.has("pressure instability")) return "Pressure stabilizing after drop"
  if (risks.has("snowfall") || risks.has("snow conditions") || risks.has("snow shower conditions")) return "Recovering after snowfall"
  if (risks.has("heavy rain") || risks.has("heavy showers") || risks.has("thunderstorm conditions")) return "Recovering after severe weather"
  if (risks.has("high wind") || risks.has("wind") || risks.has("strong gusts") || risks.has("precipitation")) return "Recovering after sustained weather stress"
  return "Recovering after sustained stress"
}

function weatherConditionPenalty(code) {
  if (code >= 95) return 0.9
  if (code >= 85 && code <= 86) return 0.72
  if (code >= 75 && code <= 77) return 0.68
  if (code >= 80 && code <= 82) return 0.55
  if (code >= 65 && code <= 67) return 0.58
  if (code >= 71 && code <= 73) return 0.46
  if (code >= 61 && code <= 63) return 0.34
  if (code === 45 || code === 48) return 0.28
  return 0
}
