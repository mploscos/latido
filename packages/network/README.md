# @latido/network

WebSocket and Server-Sent Events sources for Latido.

## Usage

```js
import { createLatido } from "@latido/core"
import { network } from "@latido/network"

const latido = createLatido().use(network({
  webSocket: {
    url: "wss://example.com/signals",
    sources: {
      "remote.energy": "audio.energy",
      "remote.beat": payload => payload.beat ? 1 : 0
    }
  },
  sse: {
    url: "/events",
    sources: {
      "server.load": "load"
    }
  }
}))

latido.start()
```

Messages are parsed as JSON when possible. Source selectors can be dot paths, mapper functions, or `true` for the whole payload.

For tests, demos, or custom runtimes, channels can inject a compatible `WebSocket` or `EventSource` constructor.
