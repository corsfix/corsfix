(function (global) {
  "use strict";

  const originalFetch = global.fetch;

  const corsfixFetch = (url, options = {}) => {
    const urlString = url instanceof URL ? url.href : url;
    const proxiedUrl = `https://proxy.corsfix.com/?${urlString}`;

    const { corsfix, ...fetchOptions } = options;

    const headers = new Headers(fetchOptions.headers || {});

    if (corsfix?.cache) {
      headers.set("x-corsfix-cache", "true");
    }

    if (corsfix?.headers) {
      headers.set("x-corsfix-headers", JSON.stringify(corsfix.headers));
    }

    const finalOptions = {
      ...fetchOptions,
      headers,
    };

    return originalFetch(proxiedUrl, finalOptions);
  };

  global.corsfix = {
    fetch: corsfixFetch,
  };
})(window);
