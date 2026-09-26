// Builds ready-to-paste code for calling an API through the Corsfix proxy,
// following the patterns in the Corsfix docs (proxy URL prefix, SDK options,
// x-corsfix-cache and x-corsfix-headers).

export type SnippetStyle =
  | "fetch"
  | "sdk"
  | "sdk-script-tag"
  | "axios"
  | "jquery"
  | "curl";

export interface SnippetInput {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  style: SnippetStyle;
  cache?: string;
  overrideHeaders: Record<string, string>;
  proxyBaseUrl: string;
  // Only set when the SDK should use a non-default endpoint.
  sdkProxyUrl?: string;
  origin?: string;
}

const DEFAULT_PROXY = "https://proxy.corsfix.com";

const str = (value: string) => JSON.stringify(value);

const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line, index) => (index === 0 ? line : " ".repeat(spaces) + line))
    .join("\n");

const objectLiteral = (entries: [string, string][], spaces: number) => {
  if (entries.length === 0) return "{}";
  const pad = " ".repeat(spaces + 2);
  const lines = entries.map(([key, value]) => `${pad}${str(key)}: ${value},`);
  return `{\n${lines.join("\n")}\n${" ".repeat(spaces)}}`;
};

// A JSON body becomes JSON.stringify({...}) so it reads naturally; any other
// body is passed as a string.
const bodyExpression = (body: string) => {
  try {
    const parsed = JSON.parse(body);
    if (parsed !== null && typeof parsed === "object") {
      return `JSON.stringify(${JSON.stringify(parsed, null, 2)})`;
    }
  } catch {
    // not JSON
  }
  return str(body);
};

const isJsonResponseLikely = (input: SnippetInput) =>
  !/\.(png|jpe?g|gif|webp|svg|pdf|zip|mp3|mp4|csv|txt|html?)(\?|$)/i.test(
    input.url
  );

function proxyHeaders(input: SnippetInput): [string, string][] {
  const entries: [string, string][] = Object.entries(input.headers).map(
    ([key, value]) => [key, str(value)]
  );
  if (input.cache) entries.push(["x-corsfix-cache", str(input.cache)]);
  if (Object.keys(input.overrideHeaders).length > 0) {
    entries.push([
      "x-corsfix-headers",
      `JSON.stringify(${JSON.stringify(input.overrideHeaders)})`,
    ]);
  }
  return entries;
}

function fetchSnippet(input: SnippetInput): string {
  const proxied = `${input.proxyBaseUrl}/?${input.url}`;
  const options: string[] = [];
  if (input.method !== "GET") options.push(`method: ${str(input.method)}`);
  const headers = proxyHeaders(input);
  if (headers.length) options.push(`headers: ${objectLiteral(headers, 2)}`);
  if (input.body !== undefined && input.method !== "GET") {
    options.push(`body: ${indent(bodyExpression(input.body), 2)}`);
  }
  const init = options.length ? `, {\n  ${options.join(",\n  ")},\n}` : "";
  const parse = isJsonResponseLikely(input) ? "json" : "text";
  return `const response = await fetch(${str(
    proxied
  )}${init});\nconst data = await response.${parse}();`;
}

function sdkCall(input: SnippetInput): string {
  const options: string[] = [];
  if (input.method !== "GET") options.push(`method: ${str(input.method)}`);
  const headers = Object.entries(input.headers).map(
    ([key, value]) => [key, str(value)] as [string, string]
  );
  if (headers.length) options.push(`headers: ${objectLiteral(headers, 2)}`);
  if (input.body !== undefined && input.method !== "GET") {
    options.push(`body: ${indent(bodyExpression(input.body), 2)}`);
  }
  const corsfix: [string, string][] = [];
  if (input.cache) corsfix.push(["cache", str(input.cache)]);
  if (Object.keys(input.overrideHeaders).length > 0) {
    corsfix.push([
      "headers",
      indent(JSON.stringify(input.overrideHeaders, null, 2), 4),
    ]);
  }
  if (input.sdkProxyUrl && input.sdkProxyUrl !== DEFAULT_PROXY) {
    corsfix.push(["proxyUrl", str(input.sdkProxyUrl)]);
  }
  if (corsfix.length) {
    options.push(
      `corsfix: {\n${corsfix
        .map(([key, value]) => `    ${key}: ${value},`)
        .join("\n")}\n  }`
    );
  }
  const init = options.length ? `, {\n  ${options.join(",\n  ")},\n}` : "";
  return `corsfix.fetch(${str(input.url)}${init})`;
}

function sdkSnippet(input: SnippetInput): string {
  const parse = isJsonResponseLikely(input) ? "json" : "text";
  return `import corsfix from "corsfix"; // npm install corsfix\n\nconst response = await ${sdkCall(
    input
  )};\nconst data = await response.${parse}();`;
}

function sdkScriptTagSnippet(input: SnippetInput): string {
  const parse = isJsonResponseLikely(input) ? "json" : "text";
  return `<script src="https://unpkg.com/corsfix"></script>\n<script>\n  ${indent(
    `${sdkCall(
      input
    )}\n  .then((response) => response.${parse}())\n  .then((data) => console.log(data));`,
    2
  )}\n</script>`;
}

function axiosSnippet(input: SnippetInput): string {
  const proxied = `${input.proxyBaseUrl}/?${input.url}`;
  const config: string[] = [
    `url: ${str(proxied)}`,
    `method: ${str(input.method.toLowerCase())}`,
  ];
  const headers = proxyHeaders(input);
  if (headers.length) config.push(`headers: ${objectLiteral(headers, 2)}`);
  if (input.body !== undefined && input.method !== "GET") {
    config.push(`data: ${indent(bodyExpression(input.body), 2)}`);
  }
  return `import axios from "axios";\n\nconst { data } = await axios({\n  ${config.join(
    ",\n  "
  )},\n});`;
}

function jquerySnippet(input: SnippetInput): string {
  const proxied = `${input.proxyBaseUrl}/?${input.url}`;
  const config: string[] = [
    `url: ${str(proxied)}`,
    `method: ${str(input.method)}`,
  ];
  const headers = proxyHeaders(input);
  if (headers.length) config.push(`headers: ${objectLiteral(headers, 2)}`);
  if (input.body !== undefined && input.method !== "GET") {
    config.push(`data: ${indent(bodyExpression(input.body), 2)}`);
  }
  return `$.ajax({\n  ${config.join(
    ",\n  "
  )},\n}).done((data) => console.log(data));`;
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

function curlSnippet(input: SnippetInput): string {
  const proxied = `${input.proxyBaseUrl}/?${input.url}`;
  const parts = [`curl ${shellQuote(proxied)}`];
  if (input.method !== "GET") parts.push(`-X ${input.method}`);
  parts.push(
    `-H ${shellQuote(`Origin: ${input.origin || "http://localhost:3000"}`)}`
  );
  for (const [key, value] of Object.entries(input.headers)) {
    parts.push(`-H ${shellQuote(`${key}: ${value}`)}`);
  }
  if (input.cache)
    parts.push(`-H ${shellQuote(`x-corsfix-cache: ${input.cache}`)}`);
  if (Object.keys(input.overrideHeaders).length > 0) {
    parts.push(
      `-H ${shellQuote(
        `x-corsfix-headers: ${JSON.stringify(input.overrideHeaders)}`
      )}`
    );
  }
  if (input.body !== undefined && input.method !== "GET") {
    parts.push(`--data ${shellQuote(input.body)}`);
  }
  return parts.join(" \\\n  ");
}

export function buildSnippet(input: SnippetInput): {
  language: string;
  code: string;
} {
  switch (input.style) {
    case "sdk":
      return { language: "javascript", code: sdkSnippet(input) };
    case "sdk-script-tag":
      return { language: "html", code: sdkScriptTagSnippet(input) };
    case "axios":
      return { language: "javascript", code: axiosSnippet(input) };
    case "jquery":
      return { language: "javascript", code: jquerySnippet(input) };
    case "curl":
      return { language: "bash", code: curlSnippet(input) };
    default:
      return { language: "javascript", code: fetchSnippet(input) };
  }
}
