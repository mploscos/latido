import { createLatido } from "@latido/core"
import { audio } from "@latido/audio"
import { dom } from "@latido/dom"
import { targets } from "@latido/targets"
import { Application, Container, Graphics, Text } from "pixi.js"
import * as THREE from "three"
import "./multi-target.css"

const root = document.documentElement
const audioElement = document.querySelector("audio")
const button = document.querySelector(".play-button")
const safeToggle = document.querySelector(".safe-mode-toggle")
const pixiView = document.querySelector(".pixi-view")
const canvas = document.querySelector(".canvas-view")
const threeCanvas = document.querySelector(".three-view")
const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
const visual = {
  safeMode: true,
  beat: 0,
  lastFlashAt: -Infinity,
  lastRingAt: -Infinity
}

main()

async function main() {
  const pixiScene = await createPixiScene(pixiView)
  const canvasScene = createCanvasScene(canvas)
  const threeScene = createThreeScene(threeCanvas)

  const canvasState = { energy: 0, bass: 0, mid: 0, treble: 0, beat: 0, flux: 0, impact: 0 }
  const threeState = { energy: 0, bass: 0, mid: 0, treble: 0, beat: 0, flux: 0, impact: 0 }
  const flashLimiter = createFlashLimiter(400)

  setSafeMode(reducedMotion || safeToggle.checked)
  syncSafeState(canvasState, threeState)
  safeToggle.addEventListener("change", () => {
    setSafeMode(safeToggle.checked)
    syncSafeState(canvasState, threeState)
  })

  const latido = createLatido()
    .use(dom())
    .use(audio({ element: audioElement }))
    .use(targets({ container: pixiScene.scene }))

  latido.signal("audio.energy")
    .smooth(0.15)
    .clamp(0, 1)
    .bindCSSVar(root, "--energy")
    .bindTargetProps(pixiScene.core, {
      alpha: v => 0.45 + v * 0.55,
      scale: v => 1 + v * 0.55
    })
    .bindTarget(pixiScene.textState, "energy")
    .bindTarget(canvasState, "energy")
    .bindTarget(threeState, "energy")

  latido.signal("audio.bass")
    .smooth(0.12)
    .clamp(0, 1)
    .bindCSSVar(root, "--bass")
    .bindTarget(pixiScene.halo, "scale", v => 0.8 + v * 0.8)
    .bindTarget(pixiScene.textState, "bass")
    .bindTarget(canvasState, "bass")
    .bindTarget(threeState, "bass")

  latido.signal("audio.mid")
    .smooth(0.14)
    .clamp(0, 1)
    .bindCSSVar(root, "--mid")
    .bindTarget(pixiScene.textState, "mid")
    .bindTarget(canvasState, "mid")
    .bindTarget(threeState, "mid")

  latido.signal("audio.treble")
    .smooth(0.18)
    .clamp(0, 1)
    .bindCSSVar(root, "--treble")
    .bindTarget(pixiScene.dots, "alpha", v => 0.2 + v * 0.8)
    .bindTarget(pixiScene.textState, "treble")
    .bindTarget(canvasState, "treble")
    .bindTarget(threeState, "treble")

  latido.signal("audio.trebleFlux")
    .smooth(0.035)
    .spawnTarget((value, context) => {
      const minInterval = visual.safeMode ? 420 : 333
      const threshold = visual.safeMode ? 0.18 : 0.12
      const strength = Math.min(1, value * (visual.safeMode ? 1.7 : 2.3))

      if (strength < threshold || context.time - visual.lastRingAt < minInterval) return null
      visual.lastRingAt = context.time

      const ring = createPixiRing(strength, visual.safeMode)
      ring.position.copyFrom(pixiScene.center.position)
      return ring
    }, {
      threshold: 0.025,
      cooldownMs: 90,
      lifeMs: 760,
      update: (ring, age, progress) => {
        const strength = Math.min(1, ring.strength ?? 0)
        const range = 1 + strength * (visual.safeMode ? 1.2 : 2.5)

        ring.scale.set(0.22 + progress * range)
        ring.alpha = (1 - progress) * (0.18 + strength * (visual.safeMode ? 0.46 : 0.82))
      }
    })

  latido.signal("audio.beat")
    .bind((value, context) => {
      if (value === 1 && flashLimiter.allow(context.time)) {
        visual.beat = 1
        visual.lastFlashAt = context.time
      } else {
        visual.beat *= visual.safeMode ? 0.78 : 0.84
      }

      const beat = visual.safeMode ? visual.beat * 0.55 : visual.beat
      root.style.setProperty("--beat", String(beat))
      pixiScene.textState.beat = beat
      canvasState.beat = beat
      threeState.beat = beat
    })

  latido.signal("audio.flux")
    .smooth(0.08)
    .bind(value => {
      const flux = visual.safeMode ? Math.min(0.62, value) : value
      root.style.setProperty("--flux", String(flux))
      pixiScene.textState.flux = flux
      canvasState.flux = flux
      threeState.flux = flux
      pixiScene.burst.alpha = 0.1 + flux * (visual.safeMode ? 0.36 : 0.72)
    })

  latido.signal("audio.impact")
    .bind(value => {
      const impact = visual.safeMode ? Math.min(0.58, value) : value
      root.style.setProperty("--impact", String(impact))
      pixiScene.textState.impact = impact
      pixiScene.textState.safeMode = visual.safeMode
      canvasState.impact = impact
      canvasState.safeMode = visual.safeMode
      threeState.impact = impact
      threeState.safeMode = visual.safeMode
      pixiScene.center.scale.set(1 + impact * (visual.safeMode ? 0.08 : 0.18))
      pixiScene.burst.scale.set(1 + impact * (visual.safeMode ? 0.22 : 0.44))
    })

  latido.start()
  canvasScene.start(canvasState)
  threeScene.start(threeState)
  pixiScene.start()

  let playing = false

  button.addEventListener("click", async () => {
    if (playing) {
      latido.pause()
      button.textContent = "Play"
      playing = false
      return
    }

    await latido.play()
    button.textContent = "Pause"
    playing = true
  })
}

function setSafeMode(enabled) {
  visual.safeMode = enabled
  safeToggle.checked = enabled
  root.classList.toggle("safe-mode", enabled)
}

function syncSafeState(...states) {
  for (const state of states) {
    state.safeMode = visual.safeMode
  }
}

function createFlashLimiter(intervalMs) {
  let lastAt = -Infinity

  return {
    allow(time) {
      if (time - lastAt < intervalMs) return false
      lastAt = time
      return true
    }
  }
}

async function createPixiScene(host) {
  const app = new Application()
  await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: host })
  host.appendChild(app.canvas)

  const scene = new Container()
  app.stage.addChild(scene)

  const halo = new Graphics()
    .circle(0, 0, 74)
    .fill({ color: 0x2bd9d0, alpha: 0.16 })

  const burst = new Graphics()
    .circle(0, 0, 112)
    .stroke({ width: 2, color: 0xffffff, alpha: 0.85 })

  const core = new Graphics()
    .circle(0, 0, 36)
    .fill(0xff3d81)

  const center = new Container()
  center.addChild(burst, halo, core)
  scene.addChild(center)

  const textState = { energy: 0, bass: 0, mid: 0, treble: 0, beat: 0, flux: 0, impact: 0, safeMode: true }
  const textLayer = new Container()
  scene.addChild(textLayer)

  const headline = "LATIDO"
  const letters = Array.from(headline, char => {
    const letter = new Text({
      text: char,
      style: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 42,
        fontWeight: "900",
        fill: 0xffffff
      }
    })

    letter.anchor.set(0.5)
    textLayer.addChild(letter)
    return letter
  })

  const caption = new Text({
    text: "PIXIJS TARGET",
    style: {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 13,
      fontWeight: "800",
      fill: 0x2bd9d0
    }
  })

  caption.anchor.set(0.5)
  caption.alpha = 0.72
  textLayer.addChild(caption)

  const dots = Array.from({ length: 28 }, (_, index) => {
    const dot = new Graphics()
      .circle(0, 0, 3)
      .fill(0xffd166)

    dot.angleOffset = (Math.PI * 2 * index) / 28
    scene.addChild(dot)
    return dot
  })

  function layout() {
    const { width, height } = app.screen
    center.position.set(width / 2, height / 2)

    const radius = Math.min(width, height) * 0.34
    const letterGap = Math.max(26, Math.min(width, height) * 0.105)
    const textY = height / 2 - Math.min(height * 0.24, 132)

    textLayer.position.set(width / 2, textY)

    for (let index = 0; index < letters.length; index += 1) {
      letters[index].baseX = (index - (letters.length - 1) / 2) * letterGap
      letters[index].position.set(letters[index].baseX, 0)
    }

    caption.position.set(0, Math.max(34, letterGap * 0.82))

    for (const dot of dots) {
      dot.baseRadius = radius
      dot.position.set(
        width / 2 + Math.cos(dot.angleOffset) * radius,
        height / 2 + Math.sin(dot.angleOffset) * radius
      )
    }
  }

  function start() {
    app.ticker.add(() => {
      const { width, height } = app.screen
      const time = app.ticker.lastTime * 0.001
      const safeScale = textState.safeMode ? 0.5 : 1

      for (const dot of dots) {
        const radius = dot.baseRadius + dot.alpha * 34 + center.scale.x * 8
        const angle = dot.angleOffset + time * (0.8 + dot.alpha * 1.6)
        dot.position.set(
          width / 2 + Math.cos(angle) * radius,
          height / 2 + Math.sin(angle) * radius
        )
        dot.scale.set(0.7 + dot.alpha * 2.8)
      }

      textLayer.alpha = 0.58 + textState.energy * 0.26 + textState.impact * 0.16 * safeScale
      textLayer.scale.set(1 + textState.impact * 0.08 * safeScale + textState.beat * 0.05)

      for (let index = 0; index < letters.length; index += 1) {
        const letter = letters[index]
        const wave = Math.sin(time * 5 + index * 0.8)
        const trebleLift = textState.treble * (10 + index * 1.2) * safeScale

        letter.x = letter.baseX + wave * textState.mid * 5 * safeScale
        letter.y = wave * trebleLift - textState.beat * 8 * safeScale
        letter.rotation = wave * textState.flux * 0.08 * safeScale
        letter.scale.set(1 + textState.impact * 0.22 * safeScale + textState.treble * 0.08 * Math.max(0, wave))
        letter.tint = index % 3 === 0 ? 0xff3d81 : index % 3 === 1 ? 0xffffff : 0xffd166
      }

      caption.alpha = 0.42 + textState.flux * 0.34 + textState.beat * 0.18 * safeScale
      caption.scale.set(1 + textState.bass * 0.08 + textState.impact * 0.1 * safeScale)
    })
  }

  layout()
  app.renderer.on("resize", layout)

  return { app, scene, center, burst, halo, core, dots, textState, start }
}

function createPixiRing(strength = 0.5, safeMode = true) {
  const ring = new Graphics()
    .circle(0, 0, 42)
    .stroke({ width: 3 + strength * (safeMode ? 2 : 5), color: 0xffffff, alpha: safeMode ? 0.58 : 0.9 })

  ring.strength = strength
  return ring
}

function createCanvasScene(canvas) {
  const ctx = canvas.getContext("2d")

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function start(state) {
    resize()
    window.addEventListener("resize", resize)

    function draw(time) {
      const { width, height } = canvas.getBoundingClientRect()
      const cx = width / 2
      const cy = height / 2
      const bars = 64
      const safeScale = state.safeMode ? 0.5 : 1
      const base = Math.min(width, height) * (0.18 + state.impact * 0.04 * safeScale)

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = `rgba(16, 19, 31, ${0.82 - state.impact * 0.12 * safeScale})`
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < bars; i += 1) {
        const angle = (Math.PI * 2 * i) / bars
        const wave = Math.sin(time * 0.006 + i * 0.42) * 0.5 + 0.5
        const length = 16 + state.energy * 30 + state.treble * wave * 62 + state.bass * 28 + state.impact * 72 * safeScale
        const x1 = cx + Math.cos(angle) * base
        const y1 = cy + Math.sin(angle) * base
        const x2 = cx + Math.cos(angle) * (base + length)
        const y2 = cy + Math.sin(angle) * (base + length)

        ctx.strokeStyle = i % 3 === 0 ? "#ff3d81" : i % 3 === 1 ? "#2bd9d0" : "#ffd166"
        ctx.lineWidth = 1.6 + state.flux * 1.5 + state.beat * (state.safeMode ? 1.2 : 3)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      ctx.fillStyle = `rgba(255, 61, 129, ${0.26 + state.mid * 0.3 + state.impact * 0.18 * safeScale})`
      ctx.beginPath()
      ctx.arc(cx, cy, 20 + state.energy * 34 + state.impact * 28 * safeScale + state.beat * (state.safeMode ? 8 : 18), 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = `rgba(43, 217, 208, ${0.18 + state.flux * (state.safeMode ? 0.28 : 0.5)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, base + state.impact * 34 * safeScale, 0, Math.PI * 2)
      ctx.stroke()

      requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  }

  return { start }
}

function createThreeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 80)
  camera.position.set(0, 0, 0)

  const rings = []
  const coreRingGeometry = new THREE.TorusGeometry(2.2, 0.03, 8, 96)
  const glowRingGeometry = new THREE.TorusGeometry(2.2, 0.09, 8, 96)

  for (let index = 0; index < 34; index += 1) {
    const hue = index % 3 === 0 ? 0xff3d81 : index % 3 === 1 ? 0x2bd9d0 : 0xffd166
    const group = new THREE.Group()
    const core = new THREE.Mesh(coreRingGeometry, new THREE.MeshBasicMaterial({
      color: hue,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))
    const glow = new THREE.Mesh(glowRingGeometry, new THREE.MeshBasicMaterial({
      color: hue,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))

    group.add(glow, core)
    group.position.z = -index * 1.08 - 2
    group.rotation.z = index * 0.22
    group.userData = {
      core,
      glow,
      phase: index * 1.73,
      drift: 0.35 + (index % 7) * 0.06,
      turn: (index % 5 - 2) * 0.045,
      tiltX: Math.sin(index * 2.1) * 0.12,
      tiltY: Math.cos(index * 1.6) * 0.12
    }
    scene.add(group)
    rings.push(group)
  }

  const starGeometry = new THREE.BufferGeometry()
  const starPositions = new Float32Array(360 * 3)
  for (let index = 0; index < 360; index += 1) {
    const radius = 1.2 + Math.random() * 4.6
    const angle = Math.random() * Math.PI * 2
    starPositions[index * 3] = Math.cos(angle) * radius
    starPositions[index * 3 + 1] = Math.sin(angle) * radius
    starPositions[index * 3 + 2] = -Math.random() * 42 - 1
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.025,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  scene.add(stars)

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function start(state) {
    resize()
    window.addEventListener("resize", resize)

    function render() {
      const time = performance.now() * 0.001
      const safeScale = state.safeMode ? 0.5 : 1
      const speed = 0.1 + state.bass * 0.34 + state.flux * 0.22 + state.impact * 0.42 * safeScale
      const tunnelScale = 1 + state.energy * 0.1 + state.impact * 0.18 * safeScale
      const turnAmount = 0.12 + state.mid * 0.2 + state.impact * 0.16 * safeScale
      const lineWidth = 1 + state.flux * 1.6 + state.impact * 2.3 * safeScale
      const glowWidth = 1 + state.impact * 2.8 * safeScale + state.beat * (state.safeMode ? 1.2 : 3.5)

      for (let index = 0; index < rings.length; index += 1) {
        const ring = rings[index]
        ring.position.z += speed
        if (ring.position.z > 1.2) {
          ring.position.z -= rings.length * 1.08
        }

        const depth = Math.max(0, Math.min(1, (ring.position.z + rings.length * 1.08) / (rings.length * 1.08)))
        const path = time * ring.userData.drift + ring.userData.phase + ring.position.z * 0.28
        const wobble = Math.sin(time * 1.8 + index) * (0.05 + state.treble * 0.1)

        ring.position.x = Math.sin(path) * turnAmount * (0.7 + depth)
        ring.position.y = Math.cos(path * 0.82 + ring.userData.phase) * turnAmount * 0.72
        ring.rotation.x = ring.userData.tiltX + Math.sin(path * 0.62) * (0.08 + state.flux * 0.18)
        ring.rotation.y = ring.userData.tiltY + Math.cos(path * 0.7) * (0.08 + state.impact * 0.2)
        ring.scale.setScalar(tunnelScale + wobble)
        ring.rotation.z += 0.003 + state.mid * 0.014 + state.impact * 0.014 * safeScale

        ring.userData.core.scale.z = lineWidth
        ring.userData.glow.scale.z = glowWidth
        ring.userData.core.material.opacity = 0.16 + depth * 0.28 + state.impact * 0.18 + state.beat * (state.safeMode ? 0.08 : 0.22)
        ring.userData.glow.material.opacity = 0.04 + state.flux * 0.12 + state.impact * (state.safeMode ? 0.12 : 0.3) + state.beat * (state.safeMode ? 0.07 : 0.22)
      }

      camera.rotation.z = Math.sin(time * 0.55) * 0.018 + state.impact * 0.01 * safeScale
      stars.rotation.z += 0.001 + state.treble * 0.004 + state.impact * 0.002 * safeScale
      stars.material.opacity = 0.42 + state.flux * (state.safeMode ? 0.22 : 0.45)

      renderer.render(scene, camera)
      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)
  }

  return { start, rings, stars }
}
