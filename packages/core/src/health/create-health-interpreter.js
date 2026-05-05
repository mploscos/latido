import { clamp } from "../rules/index.js"

const defaultStates = {
  unknown: "unknown",
  stable: "stable",
  thriving: "thriving",
  healthy: "healthy",
  normal: "normal",
  stressed: "stressed",
  sick: "sick",
  recovering: "recovering",
  unstable: "unstable"
}

const defaultTrendCode = {
  worsening: 0,
  stable: 0.5,
  improving: 1
}

const defaultScoreThresholds = {
  thriving: 0.85,
  healthy: 0.65,
  normal: 0.45,
  stressed: 0.25
}

const defaultTransitionThresholds = {
  recoveryScore: 0.45,
  holdBadBelow: 0.65,
  severeScore: 0.22,
  severeEvidence: 0.95,
  recoveringExitScore: 0.72,
  unstableStressScore: 0.65,
  sickEvidence: 0.75,
  strongSickEvidence: 0.85,
  strongBadExitScore: 0.78,
  stressEvidence: 0.75,
  sustainedImprovementMargin: 0.06,
  instabilityMargin: 0.035,
  sustainedWorseningMargin: 0.05
}

/**
 * Creates a reusable temporal health interpreter.
 *
 * Domain code provides a base health descriptor from current values. The
 * interpreter adds history, trends, hysteresis, recovery and final output
 * assembly without owning any market, weather or application-specific rules.
 *
 * @param {object} options Interpreter options.
 * @param {(system: string, values: object, history: Array<object>) => object} options.deriveBase Domain base health function.
 * @param {(state: string, baseHealth: object, temporal: object) => string} [options.reasonFor] Reason text function.
 * @param {Record<string, string>} [options.states] State names.
 * @param {Record<string, number>} [options.scoreThresholds] Score thresholds for candidate states.
 * @param {Record<string, number>} [options.transitionThresholds] Thresholds for recovery and hysteresis transitions.
 * @param {string[]} [options.badStates] States considered bad for recovery logic.
 * @param {string[]} [options.goodStates] States considered good for stress hysteresis.
 * @param {number} [options.minStateDuration=4] Minimum state duration unless transition is strong.
 * @param {number} [options.minBadDurationForRecovery=4] Minimum bad-state duration needed for recovery.
 * @param {number} [options.trendThreshold=0.07] Minimum score trend delta.
 * @param {number} [options.noiseThreshold=0.035] Per-sample change ignored as noise.
 * @param {number} [options.instabilityThreshold=0.055] Minimum instability trend delta.
 * @param {Record<string, number>} [options.trendCode] Numeric trend encoding.
 * @returns {(system: string, currentValues: object, history?: Array<object>) => object}
 */
export function createHealthInterpreter(options = {}) {
  const states = { ...defaultStates, ...options.states }
  const scoreThresholds = { ...defaultScoreThresholds, ...options.scoreThresholds }
  const transitionThresholds = { ...defaultTransitionThresholds, ...options.transitionThresholds }
  const trendCode = { ...defaultTrendCode, ...options.trendCode }
  const badStates = new Set(options.badStates ?? [states.sick, states.stressed])
  const goodStates = new Set(options.goodStates ?? [states.stable, states.healthy, states.thriving])
  const minStateDuration = options.minStateDuration ?? 4
  const minBadDurationForRecovery = options.minBadDurationForRecovery ?? 4
  const trendThreshold = options.trendThreshold ?? 0.07
  const noiseThreshold = options.noiseThreshold ?? 0.035
  const instabilityThreshold = options.instabilityThreshold ?? 0.055
  const deriveBase = options.deriveBase ?? (() => unknownBase(states))
  const reasonFor = options.reasonFor ?? (state => defaultReasonFor(state, states))

  /**
   * Interprets current values and history into a temporal health state.
   *
   * @param {string} system System namespace.
   * @param {object} currentValues Current source values.
   * @param {Array<object>} [history=[]] Bounded health history.
   * @returns {object}
   */
  return function interpretHealth(system, currentValues, history = []) {
    const base = deriveBase(system, currentValues, history)
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

  function deriveTemporalContext(baseHealth, history) {
    const window = history.slice(-60)
    const previous = window.at(-1)
    const previousState = previous?.healthState ?? previous?.health?.state ?? states.unknown
    const previousDuration = consecutiveStateDuration(window, previousState, states.unknown)
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
        baseHealth.baseScore > recentAvg + transitionThresholds.sustainedImprovementMargin &&
        improvingSamples >= 3,
      instabilityDecreasing: instabilityDelta < -instabilityThreshold &&
        instabilityDecreasingSamples >= 3 &&
        (baseHealth.metrics.instability ?? 0) < recentInstabilityAvg - transitionThresholds.instabilityMargin,
      instabilityIncreasing: instabilityDelta > instabilityThreshold &&
        instabilityIncreasingSamples >= 3 &&
        (baseHealth.metrics.instability ?? 0) > recentInstabilityAvg + transitionThresholds.instabilityMargin,
      sustainedWorsening: trend === "worsening" &&
        baseHealth.baseScore < recentAvg - transitionThresholds.sustainedWorseningMargin &&
        worseningSamples >= 3
    }
  }

  function chooseNarrativeState(baseHealth, temporal) {
    const candidate = candidateState(baseHealth, temporal)
    const previous = temporal.previousState

    if (previous === states.unknown) return candidate

    if (
      temporal.recentBadSamples > 0 &&
      temporal.persistedBad &&
      temporal.sustainedImprovement &&
      temporal.instabilityDecreasing &&
      baseHealth.baseScore > transitionThresholds.recoveryScore
    ) {
      return states.recovering
    }

    if (
      badStates.has(previous) &&
      temporal.persistedBad &&
      !temporal.sustainedImprovement &&
      !badStates.has(candidate) &&
      baseHealth.baseScore < transitionThresholds.holdBadBelow
    ) {
      return previous
    }

    if (previous === states.recovering) {
      if (recoveryFailing(baseHealth, temporal)) return states.unstable
      if (baseHealth.metrics.severeEvidence > transitionThresholds.severeEvidence && baseHealth.baseScore <= transitionThresholds.severeScore) return candidate
      if (temporal.previousDuration < minStateDuration) return states.recovering
      if (baseHealth.baseScore > transitionThresholds.recoveringExitScore && temporal.trend !== "worsening" && !temporal.instabilityIncreasing) return candidate
      return states.recovering
    }

    if (previous === states.unstable) {
      if (baseHealth.metrics.severeEvidence > transitionThresholds.severeEvidence && baseHealth.baseScore <= transitionThresholds.severeScore) return candidate
      if (temporal.previousDuration < minStateDuration) return states.unstable
      if (temporal.sustainedWorsening || meaningfulStress(baseHealth, temporal) || baseHealth.baseScore < transitionThresholds.unstableStressScore) return states.stressed
      return candidate
    }

    if (temporal.previousDuration < minStateDuration && !isStrongTransition(previous, candidate, baseHealth, temporal)) {
      return previous
    }

    if (goodStates.has(previous) && candidate === states.stressed && !meaningfulStress(baseHealth, temporal)) {
      return baseHealth.metrics.calm ? states.stable : states.normal
    }

    if (candidate === states.sick && baseHealth.metrics.severeEvidence < transitionThresholds.sickEvidence && !temporal.sustainedWorsening) {
      return states.stressed
    }

    return candidate
  }

  function candidateState(baseHealth, temporal) {
    if (baseHealth.metrics.calm && Math.abs(temporal.trendDelta) < trendThreshold) return states.stable

    if (baseHealth.baseScore > scoreThresholds.thriving) return states.thriving
    if (baseHealth.baseScore > scoreThresholds.healthy) return states.healthy
    if (baseHealth.baseScore > scoreThresholds.normal) return states.normal
    if (baseHealth.baseScore > scoreThresholds.stressed) return states.stressed
    return states.sick
  }

  function meaningfulStress(baseHealth, temporal) {
    return baseHealth.metrics.stressEvidence > transitionThresholds.stressEvidence ||
      temporal.sustainedWorsening ||
      temporal.instabilityIncreasing ||
      temporal.recentBadSamples >= 3
  }

  function recoveryFailing(baseHealth, temporal) {
    return temporal.instabilityIncreasing &&
      (temporal.trend === "worsening" || temporal.trendDelta < -trendThreshold || baseHealth.baseScore < temporal.recentAvg - transitionThresholds.sustainedWorseningMargin)
  }

  function isStrongTransition(previous, candidate, baseHealth, temporal) {
    if (candidate === previous) return true
    if (candidate === states.sick && baseHealth.metrics.severeEvidence > transitionThresholds.strongSickEvidence) return true
    if (candidate === states.stressed && meaningfulStress(baseHealth, temporal)) return true
    if (badStates.has(previous) && baseHealth.baseScore > transitionThresholds.strongBadExitScore && temporal.sustainedImprovement) return true
    return false
  }

  function intensityFor(state, score, temporal) {
    const trendPressure = Math.min(0.18, Math.abs(temporal.trendDelta) * 1.2)

    if (state === states.sick) return 0.9
    if (state === states.stressed) return 0.68 + trendPressure
    if (state === states.unstable) return 0.58 + trendPressure
    if (state === states.normal) return 0.46 + trendPressure
    if (state === states.recovering) return 0.42
    if (state === states.thriving) return 0.24
    if (state === states.stable) return 0.2
    return clamp(0.24 + (1 - score) * 0.2 + trendPressure, 0.18, 0.5)
  }
}

function consecutiveStateDuration(history, state, unknownState) {
  if (state === unknownState) return 0

  let duration = 0
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const itemState = history[index]?.healthState ?? history[index]?.health?.state
    if (itemState !== state) break
    duration += 1
  }
  return duration
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

function unknownBase(states) {
  return {
    system: states.unknown,
    baseScore: 0.5,
    baseState: "normal",
    domainRisks: [],
    metrics: {}
  }
}

function defaultReasonFor(state, states) {
  if (state === states.stable) return "Stable conditions"
  return "Waiting for data"
}
