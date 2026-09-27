<div align="center">
  <p><a href="https://corsfix.com"><img src="https://corsfix.com/landing.jpg" alt="Corsfix"></a></p>
  <p>
    <a href="https://corsfix.com">Website</a> &bull; 
    <a href="https://app.corsfix.com/playground">Demo</a> &bull; 
    <a href="https://corsfix.com/docs">Documentation</a> &bull; 
    <a href="https://discord.gg/WEAeqrRjp2">Discord</a> &bull; 
    <a href="#AGPL-3.0-1-ov-file">License</a> &bull; 
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>
</div>

[Corsfix](https://corsfix.com) is the open source and secure CORS proxy platform that lets you fetch any API directly from client side JavaScript (browser) without getting CORS errors.

<p>
  <span>🔍</span>
  <a href="FAQ.md#what-is-a-cors-proxy">What is a CORS proxy?</a> &bull;
  <a href="FAQ.md#how-is-it-secure">How is it secure?</a>
</p>

## 🚀 Getting Started

Start using Corsfix in your web applications.
| Option | Description |
| --- | --- |
| [Hosted Service](https://corsfix.com) | Get started immediately with our free tier |
| [Self-Hosted](https://corsfix.com/docs/open-source/self-hosting) | Setup and run Corsfix on your own machine |

## 💫 Key Features

- Bypass CORS errors
- Setup origin and domain allowlist
- Hide API keys in the frontend
- Cache API responses
- Set forbidden headers
- Responses streamed for minimal latency
- Test requests with playground
- Track performance metrics
- Work from AI assistants with the MCP server

## 🤖 MCP Server

Corsfix has a remote [MCP](https://modelcontextprotocol.io) server, so AI assistants and coding agents such as Claude, ChatGPT, Cursor and VS Code can check CORS errors, set up your applications and secrets, write the proxy code and test requests for you. They sign in with your Corsfix account, so there is no API key to copy.

```
https://app.corsfix.com/mcp
```

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=corsfix&config=eyJ1cmwiOiJodHRwczovL2FwcC5jb3JzZml4LmNvbS9tY3AifQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=corsfix&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fapp.corsfix.com%2Fmcp%22%7D)

In Claude Code:

```bash
claude mcp add --transport http corsfix https://app.corsfix.com/mcp
```

Self-hosted instances serve their own MCP server at `https://<your app domain>/mcp`. See the [MCP docs](https://corsfix.com/docs/mcp) for other clients and the list of tools.

## 🔎 Preview

### Bypass CORS errors

![Bypass CORS errors](https://assets.corsfix.com/v6sc7ld.png)

### Setup allowed origin and domain

![Setup allowed origin and domain](https://assets.corsfix.com/r9zlfef.png)

### Manage and use API key securely

![Manage secrets](https://assets.corsfix.com/8it4qqb.png)

### Override request headers

![Override request headers](https://assets.corsfix.com/xd0esz6j.png)

### Cached response

![Cached response](https://assets.corsfix.com/pypmbrs.png)

### Playground

![Playground](https://assets.corsfix.com/zh0eczi.png)

### Performance Metrics

![Performance Metrics](https://assets.corsfix.com/s6d5kce.png)

## ⚡️ Demo

You can quickly try out Corsfix using our [Playground](https://app.corsfix.com/playground).

## 🙋 FAQ

See our [FAQ.md](FAQ.md) for answers to common questions.
