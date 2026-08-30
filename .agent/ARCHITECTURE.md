# Architecture

- Runtime: Node.js + Express (`server.js`), default port 3000.
- Frontend: static HTML/CSS/JavaScript under `public/`.
- Data/services: MongoDB-backed models with route and service modules.
- Automation: `orchestrator/` is a TypeScript CLI. It starts the server when needed, visits the real site with Playwright, persists findings/tasks/reports in `.agent/`, and creates Git checkpoints before a change.
