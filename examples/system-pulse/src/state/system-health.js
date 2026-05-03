const trendCode = {
  worsening: 0,
  stable: 0.5,
  improving: 1
}
const badStates = new Set(["sick", "stressed"])
const goodStates = new Set(["stable", "healthy", "thriving"])
const minStateDuration = 4
const minBadDurationForRecovery = 4
const trendThreshold = 0.07
const noiseThreshold = 0.035
const instabilityThreshold = 0.055
const marketScoreFactors = [
  ["deltaBoost", ({ delta }) => clamp(delta / 2.2) * 0.2],
  ["volumeBoost", ({ volume }) => clamp((volume - 0.45) / 1.25) * 0.12],
  ["deltaPenalty", ({ delta }) => -clamp(-delta / 2.8) * 0.42],
  ["volatilityPenalty", ({ volatility }) => -clamp(volatility / 2.4) * 0.32]
]
const marketRiskGroups = [
  {
    name: "trend",
    firstMatch: true,
    rules: [
      ["strong negative trend", ({ delta }) => delta < -0.9],
      ["negative trend", ({ delta }) => delta < -0.45]
    ]
  },
  // Market volatility thresholds are calibrated for the current fallback/Stooq
  // signal shape. Real providers should normalize volatility before reusing
  // the same interpretation thresholds.
  {
    name: "volatility",
    firstMatch: true,
    rules: [
      ["high volatility", ({ volatility }) => volatility > 1.35],
      ["volatility", ({ volatility }) => volatility > 1]
    ]
  },
  {
    name: "movement",
    rules: [
      ["volatility rising", ({ volatilityDelta }) => volatilityDelta > 0.22],
      ["negative movement building", ({ deltaDrift }) => deltaDrift < -0.28],
      ["low activity", ({ volume }) => volume < 0.35],
      ["positive trend", ({ delta, volatility }) => delta > 0.25 && volatility < 1],
      ["calm market", ({ calm }) => calm]
    ]
  }
]
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
      ["high wind", ({ wind }) => wind > 30],
      ["wind", ({ wind }) => wind > 20]
    ]
  },
  {
    name: "precipitation",
    firstMatch: true,
    rules: [
      ["precipitation", ({ precipitation }) => precipitation > 2],
      ["light precipitation", ({ precipitation }) => precipitation > 0]
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

export function deriveSystemHealth(system, currentValues, history = []) {
  const base = system === "market"
    ? deriveMarketBase(currentValues, history)
    : system === "weather"
      ? deriveWeatherBase(currentValues, history)
      : unknownBase()
  const temporal = deriveTemporalContext(base, history)
  const state = chooseNarrativeState(base, temporal)
  const reason = reasonFor(state, base, temporal)

  return {
    state,
    score: base.baseScore,
    trend: temporal.trend,
    trendCode: trendCode[temporal.trend] ?? trendCode.stable,
    trendDelta: temporal.trendDelta,
    reason,
    intensity: intensityFor(state, base.baseScore, temporal),
    baseState: base.baseState,
    baseScore: base.baseScore,
    instability: base.metrics.instability ?? 0,
    domainRisks: base.domainRisks,
    stateDuration: state === temporal.previousState ? temporal.previousDuration + 1 : 1,
    temporal: {
      previousState: temporal.previousState,
      previousDuration: temporal.previousDuration,
      recentAvg: temporal.recentAvg,
      olderAvg: temporal.olderAvg,
      recentBadSamples: temporal.recentBadSamples,
      totalBadSamples: temporal.totalBadSamples,
      improvingSamples: temporal.improvingSamples,
      worseningSamples: temporal.worseningSamples,
      instabilityDelta: temporal.instabilityDelta,
      instabilityDecreasingSamples: temporal.instabilityDecreasingSamples,
      instabilityIncreasingSamples: temporal.instabilityIncreasingSamples
    }
  }
}

function deriveMarketBase(values, history) {
  const delta = read(values, "market.delta")
  const volume = read(values, "market.volume")
  const volatility = read(values, "market.volatility")
  const previous = previousValues(history)
  const previousVolatility = readOr(previous, "market.volatility", volatility)
  const previousDelta = readOr(previous, "market.delta", delta)
  const volatilityDelta = volatility - previousVolatility
  const deltaDrift = delta - previousDelta
  const instability = clamp(volatility / 2.4)
  const calm = Math.abs(delta) < 0.22 && volatility < 0.7
  const context = { delta, volume, volatility, volatilityDelta, deltaDrift, calm }
  const baseScore = scoreFromFactors(0.72, marketScoreFactors, context)
  const domainRisks = collectRisks(marketRiskGroups, context)

  return base("market", baseScore, domainRisks, {
    delta,
    volume,
    volatility,
    instability,
    volatilityDelta,
    calm,
    stressEvidence: clamp((volatility - 1) / 1.1) + clamp((-delta - 0.45) / 1.4),
    severeEvidence: clamp((volatility - 1.5) / 1) + clamp((-delta - 1.1) / 1.5)
  })
}

function deriveWeatherBase(values, history) {
  const temperature = read(values, "weather.temperature")
  const wind = read(values, "weather.wind")
  const pressure = read(values, "weather.pressure")
  const precipitation = read(values, "weather.precipitation")
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
  const precipitationPenalty = clamp(precipitation / 8)
  const pressureStabilityPenalty = clamp(pressureShift / 7)
  const pressureRangePenalty = clamp((Math.abs(pressure - 1013) - 22) / 35)
  const context = {
    temperature,
    wind,
    precipitation,
    pressureDelta,
    pressureShift,
    previousWind,
    previousPrecipitation,
    temperaturePenalty
  }
  const instability = clamp(
    windPenalty * 0.35 +
    precipitationPenalty * 0.3 +
    pressureStabilityPenalty * 0.25 +
    temperaturePenalty * 0.1
  )
  const baseScore = clamp(
    0.98 -
    temperaturePenalty * 0.32 -
    windPenalty * 0.26 -
    precipitationPenalty * 0.26 -
    pressureStabilityPenalty * 0.14 -
    pressureRangePenalty * 0.06
  )
  const calm = temperaturePenalty === 0 && wind < 12 && precipitation === 0 && pressureShift < 0.8
  const domainRisks = collectRisks(weatherRiskGroups, { ...context, calm })

  return base("weather", baseScore, domainRisks, {
    temperature,
    wind,
    precipitation,
    instability,
    pressureDelta,
    pressureShift,
    calm,
    stressEvidence: windPenalty + precipitationPenalty + pressureStabilityPenalty + temperaturePenalty,
    severeEvidence: clamp((wind - 42) / 20) + clamp((precipitation - 7) / 8) + clamp((temperaturePenalty - 0.65) / 0.35)
  })
}

function deriveTemporalContext(baseHealth, history) {
  const window = history.slice(-60)
  const previous = window.at(-1)
  const previousState = previous?.healthState ?? previous?.health?.state ?? "unknown"
  const previousDuration = consecutiveStateDuration(window, previousState)
  const scores = healthScores(window)
  const recentScores = scores.slice(-10)
  const olderScores = scores.slice(-30, -10)
  const recentAvg = recentScores.length ? average(recentScores) : baseHealth.baseScore
  const olderAvg = olderScores.length ? average(olderScores) : recentAvg
  const trendDelta = olderScores.length >= 4 ? recentAvg - olderAvg : baseHealth.baseScore - recentAvg
  const sampleDeltas = scoreDeltas([...scores.slice(-8), baseHealth.baseScore])
  const improvingSamples = sampleDeltas.filter(delta => delta > noiseThreshold).length
  const worseningSamples = sampleDeltas.filter(delta => delta < -noiseThreshold).length
  const instabilityValues = instabilityScores(window)
  const recentInstability = instabilityValues.slice(-10)
  const olderInstability = instabilityValues.slice(-30, -10)
  const recentInstabilityAvg = recentInstability.length
    ? average(recentInstability)
    : baseHealth.metrics.instability ?? 0
  const olderInstabilityAvg = olderInstability.length ? average(olderInstability) : recentInstabilityAvg
  const instabilityDelta = olderInstability.length >= 4
    ? recentInstabilityAvg - olderInstabilityAvg
    : (baseHealth.metrics.instability ?? 0) - recentInstabilityAvg
  const instabilityDeltas = scoreDeltas([...instabilityValues.slice(-8), baseHealth.metrics.instability ?? 0])
  const instabilityDecreasingSamples = instabilityDeltas.filter(delta => delta < -noiseThreshold).length
  const instabilityIncreasingSamples = instabilityDeltas.filter(delta => delta > noiseThreshold).length
  const recentWindow = window.slice(-12)
  const recentBadEntries = recentWindow.filter(item => badStates.has(item.healthState ?? item.health?.state))
  const totalBadEntries = window.filter(item => badStates.has(item.healthState ?? item.health?.state))
  const recentBadSamples = recentBadEntries.length
  const totalBadSamples = totalBadEntries.length
  const recentBadRisks = [...new Set(recentBadEntries.flatMap(item => item.health?.domainRisks ?? []))]
  const trend = trendDelta > trendThreshold && improvingSamples >= 3
    ? "improving"
    : trendDelta < -trendThreshold && worseningSamples >= 3
      ? "worsening"
      : "stable"

  return {
    previousState,
    previousDuration,
    recentAvg,
    olderAvg,
    recentInstabilityAvg,
    olderInstabilityAvg,
    instabilityDelta,
    trendDelta,
    trend,
    improvingSamples,
    worseningSamples,
    instabilityDecreasingSamples,
    instabilityIncreasingSamples,
    recentBadSamples,
    totalBadSamples,
    recentBadRisks,
    persistedBad: badStates.has(previousState) && previousDuration >= minBadDurationForRecovery ||
      recentBadSamples >= minBadDurationForRecovery,
    sustainedImprovement: trend === "improving" &&
      baseHealth.baseScore > recentAvg + 0.06 &&
      improvingSamples >= 3,
    instabilityDecreasing: instabilityDelta < -instabilityThreshold &&
      instabilityDecreasingSamples >= 3 &&
      (baseHealth.metrics.instability ?? 0) < recentInstabilityAvg - 0.035,
    instabilityIncreasing: instabilityDelta > instabilityThreshold &&
      instabilityIncreasingSamples >= 3 &&
      (baseHealth.metrics.instability ?? 0) > recentInstabilityAvg + 0.035,
    sustainedWorsening: trend === "worsening" &&
      baseHealth.baseScore < recentAvg - 0.05 &&
      worseningSamples >= 3
  }
}

function chooseNarrativeState(baseHealth, temporal) {
  const candidate = candidateState(baseHealth, temporal)
  const previous = temporal.previousState

  if (previous === "unknown") return candidate

  if (
    temporal.recentBadSamples > 0 &&
    temporal.persistedBad &&
    temporal.sustainedImprovement &&
    temporal.instabilityDecreasing &&
    baseHealth.baseScore > 0.45
  ) {
    return "recovering"
  }

  if (
    badStates.has(previous) &&
    temporal.persistedBad &&
    !temporal.sustainedImprovement &&
    !badStates.has(candidate) &&
    baseHealth.baseScore < 0.65
  ) {
    return previous
  }

  if (previous === "recovering") {
    if (recoveryFailing(baseHealth, temporal)) return "unstable"
    if (baseHealth.metrics.severeEvidence > 0.95 && baseHealth.baseScore <= 0.22) return candidate
    if (temporal.previousDuration < minStateDuration) return "recovering"
    if (baseHealth.baseScore > 0.72 && temporal.trend !== "worsening" && !temporal.instabilityIncreasing) return candidate
    return "recovering"
  }

  if (previous === "unstable") {
    if (baseHealth.metrics.severeEvidence > 0.95 && baseHealth.baseScore <= 0.22) return candidate
    if (temporal.previousDuration < minStateDuration) return "unstable"
    if (temporal.sustainedWorsening || meaningfulStress(baseHealth, temporal) || baseHealth.baseScore < 0.65) return "stressed"
    return candidate
  }

  if (temporal.previousDuration < minStateDuration && !isStrongTransition(previous, candidate, baseHealth, temporal)) {
    return previous
  }

  if (goodStates.has(previous) && candidate === "stressed" && !meaningfulStress(baseHealth, temporal)) {
    return baseHealth.metrics.calm ? "stable" : "normal"
  }

  if (candidate === "sick" && baseHealth.metrics.severeEvidence < 0.75 && !temporal.sustainedWorsening) {
    return "stressed"
  }

  return candidate
}

function candidateState(baseHealth, temporal) {
  if (baseHealth.metrics.calm && Math.abs(temporal.trendDelta) < trendThreshold) return "stable"

  if (baseHealth.baseScore > 0.85) return "thriving"
  if (baseHealth.baseScore > 0.65) return "healthy"
  if (baseHealth.baseScore > 0.45) return "normal"
  if (baseHealth.baseScore > 0.25) return "stressed"
  return "sick"
}

function meaningfulStress(baseHealth, temporal) {
  return baseHealth.metrics.stressEvidence > 0.75 ||
    temporal.sustainedWorsening ||
    temporal.instabilityIncreasing ||
    temporal.recentBadSamples >= 3
}

function recoveryFailing(baseHealth, temporal) {
  return temporal.instabilityIncreasing &&
    (temporal.trend === "worsening" || temporal.trendDelta < -trendThreshold || baseHealth.baseScore < temporal.recentAvg - 0.05)
}

function isStrongTransition(previous, candidate, baseHealth, temporal) {
  if (candidate === previous) return true
  if (candidate === "sick" && baseHealth.metrics.severeEvidence > 0.85) return true
  if (candidate === "stressed" && meaningfulStress(baseHealth, temporal)) return true
  if (badStates.has(previous) && baseHealth.baseScore > 0.78 && temporal.sustainedImprovement) return true
  return false
}

function reasonFor(state, baseHealth, temporal) {
  const risks = new Set(baseHealth.domainRisks)

  if (state === "recovering") return recoveringReason(baseHealth, temporal)
  if (state === "unstable") return "Recovery failing, volatility rising"
  if (state === "stable") return baseHealth.system === "market"
    ? "Stable conditions with low volatility"
    : "Stable conditions with calm weather"

  if (baseHealth.system === "weather") {
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

  if (risks.has("volatility rising") && temporal.sustainedWorsening) return "Volatility increasing rapidly"
  if (risks.has("strong negative trend") && risks.has("high volatility")) {
    return "Strong negative trend with high volatility"
  }
  if (risks.has("negative trend") && risks.has("volatility")) return "Negative movement with volatility"
  if (risks.has("positive trend") && !risks.has("high volatility")) return "Positive trend with low volatility"
  if (state === "stressed") return "Market instability is persisting"
  if (state === "sick") return "Sustained negative market pressure"
  if (state === "thriving") return "Positive trend with low volatility"
  if (state === "healthy") return "Controlled volatility and balanced activity"
  return "Mixed market pressure"
}

function recoveringReason(baseHealth, temporal) {
  const risks = new Set([...baseHealth.domainRisks, ...temporal.recentBadRisks])

  if (risks.has("pressure dropping") || risks.has("pressure instability")) return "Pressure stabilizing after drop"
  if (risks.has("high wind") || risks.has("wind") || risks.has("precipitation")) return "Recovering after sustained weather stress"
  if (risks.has("high volatility") || risks.has("volatility") || risks.has("volatility rising")) {
    return "Recovering after sustained instability"
  }
  if (risks.has("strong negative trend") || risks.has("negative trend")) return "Recovering after sustained drop"
  return "Recovering after sustained stress"
}

function intensityFor(state, score, temporal) {
  const trendPressure = Math.min(0.18, Math.abs(temporal.trendDelta) * 1.2)

  if (state === "sick") return 0.9
  if (state === "stressed") return 0.68 + trendPressure
  if (state === "unstable") return 0.58 + trendPressure
  if (state === "normal") return 0.46 + trendPressure
  if (state === "recovering") return 0.42
  if (state === "thriving") return 0.24
  if (state === "stable") return 0.2
  return clamp(0.24 + (1 - score) * 0.2 + trendPressure, 0.18, 0.5)
}

function base(system, baseScore, domainRisks, metrics) {
  const score = clamp(baseScore)

  return {
    system,
    baseScore: score,
    baseState: score > 0.85
      ? "thriving"
      : score > 0.65
        ? "healthy"
        : score > 0.45
          ? "normal"
          : score > 0.25
            ? "stressed"
            : "sick",
    domainRisks,
    metrics
  }
}

function unknownBase() {
  return {
    system: "unknown",
    baseScore: 0.5,
    baseState: "normal",
    domainRisks: [],
    metrics: {}
  }
}

function scoreFromFactors(initialScore, factors, context) {
  let score = initialScore
  for (const [, factor] of factors) {
    score += factor(context)
  }
  return clamp(score)
}

function collectRisks(groups, context) {
  const risks = []

  for (const group of groups) {
    for (const [risk, matches] of group.rules) {
      if (!matches(context)) continue
      risks.push(risk)
      if (group.firstMatch) break
    }
  }

  return risks
}

function consecutiveStateDuration(history, state) {
  if (state === "unknown") return 0

  let duration = 0
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const itemState = history[index]?.healthState ?? history[index]?.health?.state
    if (itemState !== state) break
    duration += 1
  }
  return duration
}

function previousValues(history) {
  return history.at(-1)?.values ?? history.at(-1)?.rawValues ?? {}
}

function healthScores(history) {
  return history
    .map(item => Number(item.healthScore ?? item.health?.score))
    .filter(Number.isFinite)
}

function instabilityScores(history) {
  return history
    .map(item => Number(item.health?.instability))
    .filter(Number.isFinite)
}

function scoreDeltas(scores) {
  const deltas = []
  for (let index = 1; index < scores.length; index += 1) {
    deltas.push(scores[index] - scores[index - 1])
  }
  return deltas
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function read(values, name) {
  const number = Number(values?.[name])
  return Number.isFinite(number) ? number : 0
}

function readOr(values, name, fallback) {
  const number = Number(values?.[name])
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}
