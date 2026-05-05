import {
  clamp,
  collectRisks,
  createBaseHealth,
  previousValues,
  read,
  readOr,
  scoreFromFactors
} from "@latido/core"

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

/**
 * Derives market base health from current market values.
 *
 * @param {object} values Current source values.
 * @param {Array<object>} history Health history.
 * @returns {object}
 */
export function deriveMarketBase(values, history) {
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

  return createBaseHealth("market", baseScore, domainRisks, {
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

/**
 * Explains the interpreted market health state.
 *
 * @param {string} state Final health state.
 * @param {object} baseHealth Domain base health.
 * @param {object} temporal Temporal context.
 * @returns {string}
 */
export function reasonMarketHealth(state, baseHealth, temporal) {
  const risks = new Set(baseHealth.domainRisks)

  if (state === "recovering") return recoveringMarketReason(baseHealth, temporal)
  if (state === "unstable") return "Recovery failing, volatility rising"
  if (state === "stable") return "Stable conditions with low volatility"
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

function recoveringMarketReason(baseHealth, temporal) {
  const risks = new Set([...baseHealth.domainRisks, ...temporal.recentBadRisks])

  if (risks.has("high volatility") || risks.has("volatility") || risks.has("volatility rising")) {
    return "Recovering after sustained instability"
  }
  if (risks.has("strong negative trend") || risks.has("negative trend")) return "Recovering after sustained drop"
  return "Recovering after sustained stress"
}
