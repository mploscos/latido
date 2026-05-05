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
        translate(
          calc(var(--latido-core-jitter-x, 0px) + var(--latido-core-wind-x, 0) * var(--latido-core-wind-offset, 8px)),
          calc(var(--latido-core-jitter-y, 0px) + var(--latido-core-wind-y, 0) * var(--latido-core-wind-offset, 8px))
        )
        rotate(calc((var(--tone, 0.5) - 0.5) * 10deg + var(--latido-core-wind-x, 0) * -4deg))
        scale(
          calc((0.86 + var(--energy, 0) * 0.16 + var(--beat, 0) * 0.16) * var(--latido-core-health-scale, 1)),
          calc((0.86 + var(--energy, 0) * 0.16 + var(--beat, 0) * 0.16) * var(--latido-core-health-scale, 1))
        );
      transition:
        transform var(--latido-core-transition, 120ms linear),
        opacity var(--latido-core-transition, 120ms linear),
        filter var(--latido-core-transition, 120ms linear);
      opacity: var(--latido-core-opacity, 1);
      filter: var(--latido-core-filter, none);
      z-index: 2;
    }

    .ring,
    .heart,
    .mark-shell {
      position: absolute;
      border-radius: 50%;
    }

    .ring {
      inset: 0;
      border: 1px solid rgba(242, 244, 241, 0.38);
      border-radius:
        calc(50% + var(--latido-core-wind-x, 0) * 10%)
        calc(50% - var(--latido-core-wind-x, 0) * 8%)
        calc(50% - var(--latido-core-wind-x, 0) * 11%)
        calc(50% + var(--latido-core-wind-x, 0) * 9%) /
        calc(50% + var(--latido-core-wind-y, 0) * 9%)
        calc(50% + var(--latido-core-wind-y, 0) * 11%)
        calc(50% - var(--latido-core-wind-y, 0) * 9%)
        calc(50% - var(--latido-core-wind-y, 0) * 8%);
      box-shadow:
        inset 0 0 54px color-mix(in srgb, var(--latido-cold, #dc404f) calc((1 - var(--tone, 0.5)) * 100%), var(--latido-hot, #28d28c) calc(var(--tone, 0.5) * 100%)),
        0 0 calc((42px + var(--beat, 0) * 70px) * var(--latido-core-glow, 1)) rgba(242, 244, 241, calc(0.08 + var(--beat, 0) * 0.28 + var(--latido-core-glow-alpha, 0)));
      opacity: calc(0.64 + var(--energy, 0) * 0.28);
      transform:
        translate(
          calc(var(--latido-core-wind-x, 0) * var(--latido-core-wind-bulge, 22px)),
          calc(var(--latido-core-wind-y, 0) * var(--latido-core-wind-bulge, 22px))
        )
        rotate(calc(var(--latido-core-wind-angle, 0) * 1deg))
        scale(
          calc(1 + var(--latido-core-wind-force, 0) * 0.18),
          calc(1 - var(--latido-core-wind-force, 0) * 0.08)
        )
        rotate(calc(var(--latido-core-wind-angle, 0) * -1deg));
      transition:
        border-radius var(--latido-core-transition, 120ms linear),
        transform var(--latido-core-transition, 120ms linear),
        box-shadow var(--latido-core-transition, 120ms linear),
        opacity var(--latido-core-transition, 120ms linear);
    }

    .ring::before,
    .ring::after {
      content: "";
      position: absolute;
      border-radius: inherit;
      pointer-events: none;
    }

    .ring::before {
      inset: -10%;
      background:
        radial-gradient(
          circle at
          calc(50% - var(--latido-core-wind-x, 0) * 32%)
          calc(50% - var(--latido-core-wind-y, 0) * 32%),
          color-mix(in srgb, var(--latido-cold, #dc404f) 48%, rgba(242, 244, 241, calc(0.18 + var(--latido-core-wind-force, 0) * 0.18))),
          transparent 38%
        );
      opacity: calc(0.34 + var(--latido-core-wind-force, 0) * 0.38);
      filter: blur(calc(10px + var(--latido-core-wind-force, 0) * 10px));
      transform: translate(
        calc(var(--latido-core-wind-x, 0) * -12px),
        calc(var(--latido-core-wind-y, 0) * -12px)
      );
      mix-blend-mode: screen;
    }

    .ring::after {
      inset: -5%;
      border: 1px solid rgba(242, 244, 241, calc(0.08 + var(--latido-core-wind-force, 0) * 0.18));
      opacity: calc(var(--latido-core-wind-force, 0) * 0.72);
      transform:
        translate(
          calc(var(--latido-core-wind-x, 0) * var(--latido-core-wind-bulge, 22px) * -0.7),
          calc(var(--latido-core-wind-y, 0) * var(--latido-core-wind-bulge, 22px) * -0.7)
        )
        scale(calc(1 + var(--latido-core-wind-force, 0) * 0.12));
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
      transform:
        translate(
          calc((var(--irregularity, 0) - 0.5) * var(--beat, 0) * 10px + var(--latido-core-wind-x, 0) * var(--latido-core-wind-bulge, 22px) * 0.42),
          calc((0.5 - var(--irregularity, 0)) * var(--beat, 0) * 8px + var(--latido-core-wind-y, 0) * var(--latido-core-wind-bulge, 22px) * 0.42)
        )
        scale(calc(1 + var(--latido-core-wind-force, 0) * 0.06));
    }

    .mark-shell {
      inset: var(--latido-core-mark-inset, 34%);
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle, rgba(242, 244, 241, calc(0.12 + var(--beat, 0) * 0.18)), transparent 62%);
      box-shadow:
        inset 0 0 22px rgba(242, 244, 241, calc(0.04 + var(--beat, 0) * 0.08)),
        0 0 calc(18px + var(--beat, 0) * 24px) rgba(242, 244, 241, calc(0.08 + var(--beat, 0) * 0.12));
      opacity: var(--latido-core-mark-opacity, 0.76);
      transform: scale(calc(0.92 + var(--energy, 0) * 0.08 + var(--beat, 0) * 0.1));
      mix-blend-mode: screen;
      overflow: hidden;
    }

    .mark-shell.is-empty {
      display: none;
    }

    .mark-shell::before {
      content: "";
      position: absolute;
      inset: -28%;
      background:
        conic-gradient(
          from calc(var(--flow, 0) * 240deg),
          transparent,
          color-mix(in srgb, var(--latido-cold, #dc404f) 60%, transparent),
          transparent,
          color-mix(in srgb, var(--latido-hot, #28d28c) 58%, transparent),
          transparent
        );
      opacity: calc(0.2 + var(--energy, 0) * 0.22);
      filter: blur(10px);
    }

    slot[name="mark"] {
      position: relative;
      z-index: 1;
      width: 58%;
      height: 58%;
      display: grid;
      place-items: center;
      filter:
        drop-shadow(0 0 calc(6px + var(--beat, 0) * 9px) rgba(242, 244, 241, 0.62))
        saturate(0.72);
      opacity: calc(0.7 + var(--beat, 0) * 0.18);
    }

    slot[name="mark"]::slotted(*) {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>
  <span class="ring"></span>
  <span class="heart"></span>
  <span class="mark-shell" part="mark-shell">
    <slot name="mark"></slot>
  </span>
`

export class LatidoPulseCore extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true))
    this.markSlot = this.shadowRoot.querySelector('slot[name="mark"]')
    this.markShell = this.shadowRoot.querySelector(".mark-shell")
    this.syncMarkVisibility = this.syncMarkVisibility.bind(this)
    this.markSlot.addEventListener("slotchange", this.syncMarkVisibility)
    this.syncMarkVisibility()
  }

  syncMarkVisibility() {
    const hasMark = this.markSlot.assignedElements({ flatten: true }).length > 0
    this.markShell.classList.toggle("is-empty", !hasMark)
  }
}

export function defineLatidoPulseCore(tagName = "latido-pulse-core") {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LatidoPulseCore)
  }
}
