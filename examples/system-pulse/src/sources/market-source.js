import { fallbackMarket } from "./fallback-simulator.js"

const STOOQ_URL = "https://stooq.com/q/l/?s=^spx&i=d"

export function createMarketSource(options = {}) {
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis)
  const interval = options.interval ?? 60000
  const onData = options.onData ?? (() => {})
  const experimentalLiveMarket = options.experimentalLiveMarket ?? true
  let timer = null
  let previousDelta = 0

  return {
    start() {
      refresh()
      timer = window.setInterval(refresh, interval)
    },
    stop() {
      if (timer) window.clearInterval(timer)
    }
  }

  async function refresh() {
    if (!experimentalLiveMarket || !fetcher) {
      emitFallback()
      return
    }

    try {
      const response = await fetcher(STOOQ_URL)
      if (!response.ok) throw new Error(`Stooq responded ${response.status}`)
      const quote = parseStooqQuote(await response.text())
      const values = mapQuote(quote)
      onData({
        status: "experimental live",
        provider: "Stooq no-key CSV",
        location: "S&P 500",
        source: {
          label: "Stooq daily CSV",
          url: STOOQ_URL,
          external: true
        },
        values
      })
    } catch {
      emitFallback()
    }
  }

  function mapQuote(quote) {
    const price = quote.close
    const delta = quote.open > 0 ? ((quote.close - quote.open) / quote.open) * 100 : 0
    const range = quote.open > 0 ? ((quote.high - quote.low) / quote.open) * 100 : Math.abs(delta)
    const volume = quote.volume > 0 ? compress(quote.volume / 5000000000) : 0.45 + Math.abs(delta) * 0.16
    const volatility = Math.max(Math.abs(delta) * 0.72, range)
    const beat = Math.abs(delta - previousDelta) > 0.35 || volatility > 1.35 ? 1 : 0
    previousDelta = delta

    return {
      "market.price": price,
      "market.delta": delta,
      "market.volume": volume,
      "market.volatility": volatility,
      "market.beat": beat
    }
  }

  function emitFallback() {
    const fallback = fallbackMarket()
    onData({
      status: "fallback",
      provider: "deterministic fallback",
      location: "S&P 500",
      source: {
        label: "Deterministic local fallback",
        url: "",
        external: false
      },
      values: {
        "market.price": fallback.price,
        "market.delta": fallback.delta,
        "market.volume": fallback.volume,
        "market.volatility": fallback.volatility,
        "market.beat": fallback.beat
      }
    })
  }
}

function parseStooqQuote(csv) {
  const [headerLine, valueLine] = csv.trim().split(/\r?\n/)
  const headers = headerLine.split(",").map(name => name.trim().toLowerCase())
  const values = valueLine.split(",").map(value => value.trim())
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]))

  const quote = {
    open: readNumber(row.open),
    high: readNumber(row.high),
    low: readNumber(row.low),
    close: readNumber(row.close),
    volume: readNumber(row.volume)
  }

  if (!quote.close) throw new Error("Stooq quote did not include a close price.")
  return quote
}

function readNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function compress(value) {
  return Math.log1p(Math.max(0, value) * 3) / Math.log1p(3)
}
