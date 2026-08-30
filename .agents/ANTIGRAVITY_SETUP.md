# Antigravity setup required

Audit on 2026-08-30 found no `antigravity`, `antigravity-cli`, or `ag` command on this machine. No Antigravity API or MCP endpoint was found in the repository, so no live integration has been assumed.

To enable the reviewer, install/configure the official Antigravity CLI or MCP server, then update `.agent/config.json`:

```json
"antigravity": {
  "enabled": true,
  "command": "<verified command that writes the review JSON to stdout>",
  "reviewTimeoutMs": 60000
}
```

The command must accept the base URL as its last argument and print a JSON array of finding objects matching `.agent/findings/latest.json`. It is review-only: it receives no source-write capability. The adapter rejects malformed output and records its availability in the cycle report.
