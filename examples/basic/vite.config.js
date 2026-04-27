import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        basic: resolve(__dirname, "basic.html"),
        multiTarget: resolve(__dirname, "multi-target.html")
      }
    }
  }
})
