# Corsfix JavaScript SDK

A JavaScript library to use [Corsfix CORS Proxy](https://corsfix.com) without manually adding the proxy URL. Import the library and fetch APIs without CORS errors.

## Usage

The SDK exposes a single function, `corsfix.fetch`, that performs requests via the Corsfix proxy. Its API is identical to the native Fetch API, with an optional `corsfix` property for Corsfix-specific options.

### Script Tag (CDN)

```html
<script src="https://unpkg.com/corsfix"></script>
<script>
  corsfix
    .fetch("https://example.com")
    .then((response) => response.json())
    .then((data) => console.log(data));
</script>
```

### NPM Module

Install the package:

```bash
npm install corsfix
```

Then:

```ts
import corsfix from "corsfix";

const response = await corsfix.fetch("https://example.com");
const data = await response.json();
```

## Corsfix Options

`corsfix.fetch` accepts the same parameters as the standard `fetch`, plus an optional `corsfix` property in the request init:

```ts
interface CorsfixOptions {
  cache?: boolean | number | string; // Cache the response on the proxy
  headers?: Record<string, string>; // Override request headers sent to the target
  apiKey?: string; // API key, when domain whitelisting is not an option
  proxyUrl?: string; // Use a different proxy endpoint
}

interface CorsfixRequestInit extends RequestInit {
  corsfix?: CorsfixOptions;
}
```

### Cached response

Pass a duration such as `"10s"`, `"10m"`, `"2h"` or `"1d"` (the maximum). A plain number is treated as seconds, and `true` uses the proxy's default duration.

```ts
corsfix.fetch("https://example.com/api", {
  corsfix: { cache: "10m" },
});
```

### Header override

Set headers the proxy should send to the target, including ones browsers normally forbid such as `Origin`, `Referer` or `User-Agent`.

```ts
corsfix.fetch("https://example.com/api", {
  corsfix: {
    headers: {
      Origin: "https://example.com",
      "User-Agent": "MyApp/1.0",
    },
  },
});
```

### API key

By default the proxy recognises your site by its domain, as registered in the dashboard. If you cannot use domain whitelisting, pass an API key instead. Note that an API key used in client-side code is visible to anyone.

```ts
corsfix.fetch("https://example.com/api", {
  corsfix: { apiKey: "cfx_12345678" },
});
```

### Proxy endpoint

Requests go to `https://proxy.corsfix.com` by default. Set `proxyUrl` to use the Lite plan endpoint, a regional endpoint, or a self-hosted instance.

```ts
corsfix.fetch("https://example.com/api", {
  corsfix: { proxyUrl: "https://proxy-eu.corsfix.com" },
});
```

### Full example

```ts
import corsfix from "corsfix";

corsfix.fetch("https://example.com/api", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ data: "example" }),
  corsfix: {
    cache: "1h",
    headers: { "X-Custom-Header": "value" },
  },
});
```

## Error Handling

`corsfix.fetch` behaves like native `fetch`: it resolves with a `Response` even when the target server returns an error status such as 404 or 500.

It only throws when the **Corsfix proxy itself** rejects or fails the request, for example when the domain is not registered, the rate limit is hit, or the target is unreachable. In that case it throws a `CorsfixError`:

```ts
import corsfix, { CorsfixError } from "corsfix";

try {
  const response = await corsfix.fetch("https://example.com/api");
  const data = await response.json();
} catch (error) {
  if (error instanceof CorsfixError) {
    console.error(error.code); // e.g. "rate_limited"
    console.error(error.status); // e.g. 429
    console.error(error.message); // human-readable description
    console.error(error.ifYouAreAdmin); // guidance for the site owner
    console.error(error.ifYouAreUser); // guidance for end users
    // error.response is the raw proxy Response if you need it
  } else {
    // network failure, aborted request, etc.
  }
}
```

With the script tag, the class is available as `corsfix.CorsfixError`.

| Property | Description |
| --- | --- |
| `code` | Machine-readable error code, e.g. `domain_not_registered`, `target_not_allowed`, `rate_limited`, `timeout`. See `CorsfixErrorCode` in the type definitions for the full list. |
| `status` | HTTP status code of the proxy error response. |
| `message` | Human-readable description. |
| `ifYouAreAdmin` | What the site owner integrating Corsfix should do. |
| `ifYouAreUser` | A message suitable for showing to end users. |
| `response` | The raw proxy `Response`. |

## TypeScript Support

The package ships its own type definitions. `CorsfixOptions` and `CorsfixRequestInit` are exported for use in your own code.

## Development

```bash
pnpm install
pnpm test   # run the test suite
pnpm build  # generate corsfix.js, the CDN bundle
```

`index.js` is the single source of truth. `corsfix.js` is generated from it by `pnpm build` and is not committed; it is built automatically before publishing.

## License

MIT
