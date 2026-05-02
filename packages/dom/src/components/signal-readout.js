const template = document.createElement("template")
template.innerHTML = `
  <style>
    :host {
      display: block;
      position: absolute;
      right: clamp(14px, 2vw, 24px);
      bottom: clamp(14px, 2vw, 24px);
      width: min(320px, calc(100% - 28px));
      padding: 16px;
      border: 1px solid rgba(242, 244, 241, 0.14);
      background: rgba(8, 12, 16, 0.72);
      backdrop-filter: blur(18px);
      z-index: 3;
    }

    .title {
      margin: 0 0 12px;
      color: rgba(242, 244, 241, 0.88);
      font-size: 0.95rem;
      font-weight: 760;
    }

    dl {
      display: grid;
      gap: 10px;
      margin: 0;
    }

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }

    dt {
      color: rgba(242, 244, 241, 0.58);
      font-size: 0.78rem;
    }

    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
      font-size: 1.05rem;
      font-weight: 720;
    }

    @media (max-width: 760px) {
      :host {
        left: 14px;
        right: 14px;
        width: auto;
      }
    }
  </style>
  <p class="title"></p>
  <dl></dl>
`

export class LatidoSignalReadout extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true))
    this.titleElement = this.shadowRoot.querySelector(".title")
    this.listElement = this.shadowRoot.querySelector("dl")
    this.rows = new Map()
  }

  setTitle(title) {
    this.titleElement.textContent = title
  }

  setItems(items) {
    this.listElement.replaceChildren()
    this.rows.clear()

    for (const item of items) {
      const row = document.createElement("div")
      const label = document.createElement("dt")
      const value = document.createElement("dd")
      label.textContent = item.label
      value.textContent = item.value ?? ""
      row.append(label, value)
      this.listElement.append(row)
      this.rows.set(item.key, value)
    }
  }

  setValue(key, value) {
    const row = this.rows.get(key)
    if (row) row.textContent = value
  }
}

export function defineLatidoSignalReadout(tagName = "latido-signal-readout") {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LatidoSignalReadout)
  }
}
