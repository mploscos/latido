import "./showcase.css"

const demos = {
  basic: {
    title: "Latido Basic DOM demo",
    url: "./basic.html"
  },
  "multi-target": {
    title: "Latido Multi-target demo",
    url: "./multi-target.html"
  }
}

const tabs = Array.from(document.querySelectorAll(".tab"))
const frame = document.querySelector("[data-demo-frame]")

for (const tab of tabs) {
  tab.addEventListener("click", () => selectDemo(tab.dataset.demo))
}

function selectDemo(name) {
  const demo = demos[name]
  if (!demo || frame.dataset.activeDemo === name) return

  frame.dataset.activeDemo = name
  frame.title = demo.title
  frame.src = demo.url

  for (const tab of tabs) {
    const active = tab.dataset.demo === name
    tab.classList.toggle("is-active", active)
    tab.setAttribute("aria-selected", String(active))
  }
}
