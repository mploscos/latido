const template = document.createElement("template")
template.innerHTML = `
  <style>
    :host {
      position: absolute;
      left: 50%;
      top: var(--latido-core-top, 52%);
      width: var(--latido-core-size, clamp(180px, 27vw, 360px));
      aspect-ratio: 1;
      transform:
        translate(-50%, -50%)
        scale(calc(0.86 + var(--energy, 0) * 0.16 + var(--beat, 0) * 0.16))
        rotate(calc((var(--tone, 0.5) - 0.5) * 10deg));
      transition: transform 120ms linear;
      z-index: 2;
    }

    .ring,
    .heart {
      position: absolute;
      border-radius: 50%;
    }

    .ring {
      inset: 0;
      border: 1px solid rgba(242, 244, 241, 0.38);
      box-shadow:
        inset 0 0 54px color-mix(in srgb, var(--latido-cold, #dc404f) calc((1 - var(--tone, 0.5)) * 100%), var(--latido-hot, #28d28c) calc(var(--tone, 0.5) * 100%)),
        0 0 calc(42px + var(--beat, 0) * 70px) rgba(242, 244, 241, calc(0.08 + var(--beat, 0) * 0.28));
      opacity: calc(0.64 + var(--energy, 0) * 0.28);
    }

    .heart {
      inset: 24%;
      background:
        conic-gradient(
          from calc(var(--flow, 0) * 220deg),
          var(--latido-cold, #dc404f),
          #f1c45d,
          var(--latido-hot, #28d28c),
          #5292e0,
          var(--latido-cold, #dc404f)
        );
      filter: blur(calc(8px + var(--irregularity, 0) * 18px));
      opacity: calc(0.28 + var(--energy, 0) * 0.38 + var(--beat, 0) * 0.2);
      transform: translate(
        calc((var(--irregularity, 0) - 0.5) * var(--beat, 0) * 10px),
        calc((0.5 - var(--irregularity, 0)) * var(--beat, 0) * 8px)
      );
    }
  </style>
  <span class="ring"></span>
  <span class="heart"></span>
`

export class LatidoPulseCore extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true))
  }
}

export function defineLatidoPulseCore(tagName = "latido-pulse-core") {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LatidoPulseCore)
  }
}
