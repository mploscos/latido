import { createLatido } from "@latido/core"
import { dom } from "@latido/dom"
import { audio } from "@latido/audio"
import "./styles.css"

const button = document.querySelector(".beat-button")
const audioElement = document.querySelector("audio")

const latido = createLatido()
  .use(dom())
  .use(audio({ element: audioElement }))

latido.signal("audio.energy")
  .smooth(0.15)
  .clamp(0, 1)
  .bindCSSVar(document.body, "--energy")

latido.signal("audio.beat")
  .decay(0.2)
  .bindStyle(".beat-button", "transform", value => `scale(${1 + value * 0.12})`)
  .bindClass(".beat-button", "is-beating", value => value > 0.5)

latido.signal("audio.bass")
  .smooth(0.1)
  .bindCSSVar(".bar-bass", "--level")

latido.signal("audio.mid")
  .smooth(0.1)
  .bindCSSVar(".bar-mid", "--level")

latido.signal("audio.treble")
  .smooth(0.1)
  .bindCSSVar(".bar-treble", "--level")

latido.start()

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
