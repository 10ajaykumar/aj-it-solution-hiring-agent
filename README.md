# AJ IT Solution · Smart Hiring Agent

Web application rebuilt from `../SHUBH-Hiring-Agent.html`. Every screen, option and animation of
the original is kept (same markup, styles and behaviour, verified screen by screen against the
original), split into a maintainable Vite project with a small Express API behind it.

## Run it

```bash
npm install
cp .env.example .env        # optional: set ADMIN_TOKEN to unlock the owner access list
npm run dev                 # web on http://localhost:5173, API on :3001
```

Production:

```bash
npm run build               # writes dist/
npm start                   # serves dist/ and /api on http://127.0.0.1:3001
```

Tests: `npm test` (API + export tests), `npm run test:coverage`.

## What is in the app

Landing overview, product tour, live hiring map, S·H·U·B·H meaning, automations, Agent Studio
(9-stage requisition run with approval checkpoints), Recruiter vs SHUBH game, impact
infographics, demos by HR role, workflow, reports preview, video walkthrough, ATS integration hub,
ROI calculator, FAQ, creator. Workspace: Command console, Try it yourself (JD/CSV sandbox),
Pipeline board (drag and drop), Live analytics, 9-section TA report, Agent team autonomy, ATS
Console, Approvals queue, Missions/XP, command palette (Ctrl K), guided demo, light/dark theme,
PDF/CSV export everywhere. All data is sample data generated in the browser.

## Backend

The original page asks a host runtime (`window.claude.use(...)`) for storage. The app ships its own
implementation (`client/src/runtime/claude-shim.js`) on top of the API, so the page code is unchanged:

| Endpoint | Purpose |
|---|---|
| `POST /api/visitors` | Email entered at the welcome gate (validated, rate limited) |
| `GET /api/visitors` | Owner access list (needs `x-admin-token`) |
| `GET /api/admin/verify` | Checks the owner token |
| `POST /api/exports?name=` | Server copy of every PDF/CSV the user downloads (3 MB each, 500 files / 200 MB total, oldest pruned) |
| `GET /api/exports`, `GET /api/exports/:file` | Owner listing/download of exports |
| `GET /api/health` | Health check |

Owner mode: open the app once with `/#admin=<ADMIN_TOKEN>` (32+ chars). The fragment never reaches
the server; the token is verified, stored in the browser, removed from the URL, and the
**Access list** appears in the left panel. Wrong tokens are locked out after 10 tries in 15 minutes.
Data is written to `DATA_DIR` (default `data/`, which holds visitor emails: keep it private).
Behind a reverse proxy, set `TRUST_PROXY` so rate limits use real client IPs.

## Layout

```
client/index.html            markup (from the original)
client/public/img/           screenshots and creator photo (were inline base64)
client/src/styles/           original CSS, split by section, same order
client/src/data/             static content: requisitions, stages, recipes, ATS capabilities…
client/src/lib/              utils and PDF/CSV/HTML report builders
client/src/runtime/          window.claude runtime backed by the API
client/src/gate.js           welcome gate
client/src/app.js            workspace controller (one shared state, kept as one module)
server/                      Express API + file store
tests/                       Vitest + Supertest
```

## Differences from the original file

- Declares UTF-8, so symbols (₹, →, ✓, ⌘) render correctly when served.
- jsPDF is bundled and lazy-loaded instead of fetched from a CDN at click time.
- Live AI stays hidden, as in the original outside its host; no AI key is needed.
