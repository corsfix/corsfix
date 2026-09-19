# Corsfix JavaScript Library

A JavaScript library to use [Corsfix CORS Proxy](https://corsfix.com) without manually adding the proxy URL. Just import the library and fetch APIs without CORS error.

## Usage

The library extends the default `fetch` method to perform requests via the Corsfix proxy, automatically bypassing CORS restrictions.

The API is identical to the native Fetch API, with optional additional configuration for Corsfix-specific options.

### Script Tag (CDN)

Using the `corsfix` global variable:

```html
<script src="https://unpkg.com/corsfix"></script>
<script>
  corsfix
    .fetch("https://example.com")
    .then((response) => response.json())
    .then((data) => console.log(data));
</script>
```

Using fetch override:

```html
<script src="https://unpkg.com/corsfix/fetch.js"></script>
<script>
  fetch("https://example.com")
    .then((response) => response.json())
    .then((data) => console.log(data));
</script>
```

### NPM Module

Install the package:

```bash
npm install corsfix
```

Using the default import:

```ts
import corsfix from "corsfix";

corsfix.fetch("https://example.com");
```

Using named imports:

```ts
import { fetch } from "corsfix";

fetch("https://example.com");
```

## TypeScript Support

Corsfix is fully typed and extends the native Fetch API types. The `fetch` function accepts the same parameters as the standard `fetch`, with an additional optional `corsfix` property in the request init options:

```ts
interface CorsfixOptions {
  cache?: boolean; // Enable caching for requests
  headers?: Record<string, string>; // Additional headers for the proxy
}

interface CorsfixRequestInit extends RequestInit {
  corsfix?: CorsfixOptions; // Optional Corsfix-specific configuration
}
```

### Example with Corsfix Options

```ts
import { fetch } from "corsfix";

fetch("https://example.com/api", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ data: "example" }),
  // Corsfix-specific options
  corsfix: {
    cache: true,
    headers: {
      "X-Custom-Header": "value",
    },
  },
});
```

## License

MIT
