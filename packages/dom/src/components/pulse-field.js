const template = document.createElement("template")
template.innerHTML = `
  <style>
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
  <canvas></canvas>
`

export class LatidoPulseField extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true))
    this.canvas = this.shadowRoot.querySelector("canvas")
    this.context = this.canvas.getContext("2d")
    this.particles = []
    this.width = 1
    this.height = 1
    this.frame = null
    this.resizeObserver = new ResizeObserver(() => this.resize())
  }

  connectedCallback() {
    this.resizeObserver.observe(this)
    this.resize()
    this.draw()
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect()
    if (this.frame) cancelAnimationFrame(this.frame)
  }

  resize() {
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
    const rect = this.getBoundingClientRect()
    this.width = Math.max(1, Math.floor(rect.width))
    this.height = Math.max(1, Math.floor(rect.height))
    this.canvas.width = Math.floor(this.width * pixelRatio)
    this.canvas.height = Math.floor(this.height * pixelRatio)
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    const count = Math.floor(Math.min(520, Math.max(220, this.width * this.height / 2300)))
    this.particles = Array.from({ length: count }, () => this.createParticle())
  }

  draw(time = 0) {
    const signals = this.readSignals()
    const context = this.context
    context.clearRect(0, 0, this.width, this.height)

    const centerX = this.width * 0.5
    const centerY = this.height * 0.52
    const activeCount = Math.floor(this.particles.length * clamp(signals.density, 0.12, 1))
    const color = mixColor(signals.cold, signals.hot, signals.tone)

    for (let index = 0; index < activeCount; index += 1) {
      const particle = this.particles[index]
      const pulse = signals.beat * signals.pulse
      const jitterBase = signals.irregularity * signals.jitter
      const flowWave = Math.sin(time * 0.00055 + particle.seed * 8)
      const turbulence = jitterBase * Math.sin(time * 0.0018 + particle.seed * 19)
      const jitter = jitterBase * (
        Math.sin(time * 0.012 + particle.seed * 31) * (2.2 + signals.energy * 2.4) +
        pulse * Math.sin(time * 0.04 + particle.seed * 17) * 4
      )
      const speed = (
        0.08 +
        signals.energy * 0.78 +
        signals.flow * 0.58 +
        pulse * 1.35
      ) * signals.speed

      particle.angle += (
        0.00025 +
        particle.drift * 0.0012 +
        signals.flow * 0.0015 +
        turbulence * 0.001
      ) * signals.swirl
      particle.radius += speed * (0.55 + particle.depth * 1.1)

      const spread = particle.radius * (0.88 + particle.depth * 0.24 + pulse * 0.08)
      const driftX = Math.cos(particle.seed * 13 + time * 0.00018) * signals.flow * 16
      const driftY = Math.sin(particle.seed * 17 + time * 0.00016) * signals.flow * 12
      const angle = particle.angle + flowWave * jitterBase * (0.7 + signals.flow)
      const fall = signals.fall * particle.radius * (0.62 + particle.depth * 0.72)
      const windX = signals.windX * particle.radius * (0.28 + particle.depth * 0.36)
      const windY = signals.windY * particle.radius * (0.18 + particle.depth * 0.22)

      particle.x = centerX + Math.cos(angle) * spread + driftX + windX + jitter
      particle.y = centerY + Math.sin(angle) * spread * (0.84 + particle.depth * 0.22) + driftY + windY + fall + jitter * 0.45

      if (particle.x < -40 || particle.x > this.width + 40 || particle.y < -40 || particle.y > this.height + 40) {
        this.resetParticle(particle)
      }

      const alpha = 0.12 + particle.depth * 0.35 + signals.beat * 0.18
      context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
      context.beginPath()
      if (signals.stretch > 0.02) {
        context.ellipse(
          particle.x,
          particle.y,
          particle.size * (0.7 + signals.beat * 0.4),
          particle.size * (1 + signals.stretch * 5.2 + signals.beat * 0.8),
          signals.windAngle,
          0,
          Math.PI * 2
        )
      } else {
        context.arc(particle.x, particle.y, particle.size + signals.beat * 1.8, 0, Math.PI * 2)
      }
      context.fill()
    }

    this.frame = requestAnimationFrame(next => this.draw(next))
  }

  readSignals() {
    const styles = getComputedStyle(this)

    return {
      tone: readNumber(styles, "--tone", 0.5),
      energy: readNumber(styles, "--energy", 0),
      flow: readNumber(styles, "--flow", 0),
      irregularity: readNumber(styles, "--irregularity", 0),
      beat: readNumber(styles, "--beat", 0),
      speed: readNumber(styles, "--latido-field-speed", 1),
      density: readNumber(styles, "--latido-field-density", 0.34 + readNumber(styles, "--energy", 0) * 0.66),
      swirl: readNumber(styles, "--latido-field-swirl", 1),
      jitter: readNumber(styles, "--latido-field-jitter", 1),
      pulse: readNumber(styles, "--latido-field-pulse", 1),
      fall: readNumber(styles, "--latido-field-fall", 0),
      windX: readNumber(styles, "--latido-field-wind-x", 0),
      windY: readNumber(styles, "--latido-field-wind-y", 0),
      windAngle: readNumber(styles, "--latido-field-wind-angle", 0) * Math.PI / 180,
      stretch: readNumber(styles, "--latido-field-stretch", 0),
      cold: readColor(styles, "--latido-cold", [220, 64, 79]),
      hot: readColor(styles, "--latido-hot", [40, 210, 140])
    }
  }

  createParticle() {
    const particle = {}
    this.resetParticle(particle)
    return particle
  }

  resetParticle(particle) {
    particle.angle = Math.random() * Math.PI * 2
    particle.radius = Math.random() * 90
    particle.depth = 0.25 + Math.random() * 0.75
    particle.drift = Math.random()
    particle.seed = Math.random()
    particle.size = 0.8 + Math.random() * 2.4
    particle.x = this.width * 0.5
    particle.y = this.height * 0.5
  }
}

export function defineLatidoPulseField(tagName = "latido-pulse-field") {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LatidoPulseField)
  }
}

function readNumber(styles, name, fallback) {
  const value = Number(styles.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

function readColor(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim()
  const match = value.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!match) return fallback
  return match.slice(1).map(part => parseInt(part, 16))
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function mixColor(from, to, amount) {
  const t = Math.min(1, Math.max(0, amount))
  return from.map((value, index) => Math.round(value + (to[index] - value) * t))
}
