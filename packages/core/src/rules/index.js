/**
 * Restricts a number to a range.
 *
 * @param {number} value Input value.
 * @param {number} [min=0] Minimum value.
 * @param {number} [max=1] Maximum value.
 * @returns {number}
 */
export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Reads a finite number from an object.
 *
 * @param {object} values Values object.
 * @param {string} name Value key.
 * @returns {number}
 */
export function read(values, name) {
  const number = Number(values?.[name])
  return Number.isFinite(number) ? number : 0
}

/**
 * Reads a finite number from an object, or returns a fallback.
 *
 * @param {object} values Values object.
 * @param {string} name Value key.
 * @param {number} fallback Fallback value.
 * @returns {number}
 */
export function readOr(values, name, fallback) {
  const number = Number(values?.[name])
  return Number.isFinite(number) ? number : fallback
}

/**
 * Returns the latest value snapshot stored in a bounded history buffer.
 *
 * @param {Array<object>} history History entries.
 * @returns {object}
 */
export function previousValues(history) {
  return history.at(-1)?.values ?? history.at(-1)?.rawValues ?? {}
}

/**
 * Adds named scoring factors to an initial score and clamps the result.
 *
 * @param {number} initialScore Initial score.
 * @param {Array<[string, (context: object) => number]>} factors Named scoring factors.
 * @param {object} context Rule context.
 * @returns {number}
 */
export function scoreFromFactors(initialScore, factors, context) {
  let score = initialScore
  for (const [, factor] of factors) {
    score += factor(context)
  }
  return clamp(score)
}

/**
 * Collects matching risk labels from grouped rules.
 *
 * @param {Array<{ name: string, firstMatch?: boolean, rules: Array<[string, (context: object) => boolean]> }>} groups Rule groups.
 * @param {object} context Rule context.
 * @returns {string[]}
 */
export function collectRisks(groups, context) {
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

/**
 * Creates a normalized scored state descriptor.
 *
 * @param {string} system State namespace.
 * @param {number} baseScore Score from 0..1.
 * @param {string[]} domainRisks Domain-specific risk labels.
 * @param {object} metrics Domain-specific metrics for downstream interpretation.
 * @returns {object}
 */
export function createBaseHealth(system, baseScore, domainRisks, metrics) {
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
