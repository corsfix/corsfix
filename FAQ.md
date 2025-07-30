# FAQ

- [What is a CORS proxy?](#what-is-a-cors-proxy)
- [Why would anyone ever use it?](#why-would-anyone-ever-use-it)
- [Does it read and modify all my requests?](#does-it-read-and-modify-all-my-requests)
- [How is it secure?](#how-is-it-secure)
- [Did you come up with this idea?](#did-you-come-up-with-this-idea)
- [How is it different from existing CORS proxies?](#how-is-it-different-from-existing-cors-proxies)

## What is a CORS proxy?

A CORS proxy, such as [Corsfix](https://corsfix.com), is a service for getting around CORS errors when making API requests directly from client-side JavaScript.
It works by proxying requests to the target API, and adding the necessary CORS headers when returning the response to the client.

## Why would anyone ever use it?

If you are building or developing a full-stack application (meaning with a backend), you don't need a CORS proxy. It is not a solution for when you are the one building the API.

You would use a CORS proxy if you are building static-only client-side apps, and you want to fetch external APIs, which mostly don't provide support for direct API calls from client-side JavaScript.

## Does it read and modify all my requests?

Corsfix is a type of proxy, and in order to function, it does read the input URL that you supplied, and modifies the response of the proxied URL to add the CORS headers.

This is standard for how proxy services work. One example (but not limited to) is [Cloudflare](https://www.cloudflare.com/), which provides compression, transformation, rewrites, caching, etc. It works by reading and modifying the requests and response via Cloudflare from (your) origin server, meaning everything is visible via the proxy. ([read more](https://community.cloudflare.com/t/what-data-does-cloudflare-actually-see/28660/2))

Corsfix is a proxy specifically for tackling the CORS issue. It doesn't log your proxied requests, and since it is open source you can independently audit the code. You also have the option to self-host Corsfix to have full control over it.

## How is it secure?

These are the common concerns when using a CORS proxy. This section addresses each of them one by one:

### It can read and modify all my requests

In order to function, yes it does. By reading the target URL and modifying the proxied response to add the CORS headers. Read more on ["Does it read and modify all my requests?"](FAQ.md#does-it-read-and-modify-all-my-requests)

### It can leak cookies

Any URL that returns a `Set-Cookie` header will also get passed to the client, which stores the cookie in the browser. The thing is, the domain of that cookie won't be of the API, but instead it will be of the proxy URL. We avoid this problem by explicitly removing `Set-Cookie` headers to prevent leakage.

### It can expose local networks (SSRF)

Requests are validated down to the DNS resolution level to prevent access to unintended targets such as localhost, loopback IPs, private networks, etc., making sure it can only access the public internet.

### It can expose local files (LFI)

Protocols are validated to only allow HTTP and HTTPS, preventing access to file protocol.

### Calling authenticated API exposes API key to clients

Instead of using plain API keys on your API calls, we support secrets variables. Where you can set a variable for the API key, and the proxy will substitute it with the real value when making the request, preventing it from being exposed to the client.

## Did you come up with this idea?

We are not the first to build a CORS proxy. In fact, CORS proxies have existed for a long time (started around 2011-2012). Some of the earliest ones include [whatever-origin](https://whateverorigin.org) and the popular [cors-anywhere](https://github.com/Rob--W/cors-anywhere).

## How is it different from existing CORS proxies?

The ones mentioned above are pioneers in the CORS proxy space. However, for a more robust solution, you might want to consider Corsfix. We listed our key features in the [README.md](README.md), but some of them include the ability to:

- Control which website can access the proxy, and to fetch which domain
- Manage secrets, such as API keys, and use them securely
- Override request headers
- Cache responses
- And more.
