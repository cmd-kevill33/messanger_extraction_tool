# User Guide

## Introduction

`messanger_extraction_tool` is designed to capture a single Messenger thread from Facebook using network interception. It stores structured data in SQLite, keeps media in the filesystem, and exposes a local web UI for replay and inspection.

## Installation

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browsers:

```bash
npx playwright install
```

3. Run the setup script:

```bash
bash ./setup.sh
```

## Capture workflow

### 1. Choose a thread

- Use `--thread-id` to target a known thread directly.
- Use `--select-thread` to open Messenger and pick a thread from discovered network events.

### 2. Capture options

- `--full-history`: Scroll until the oldest message is reached.
- `--live`: Keep the capture session open and ingest updates in real time.
- `--headless` / `--no-headless`: Control whether the browser UI is visible.
- `--dry-run`: Parse events without writing data.

### 3. Example commands

```bash
npm run dev -- capture --select-thread --full-history
npm run dev -- capture --thread-id 1234567890 --live
```

## Data storage

- Structured records are saved in `data/orpheus-echo.sqlite`.
- Attachments are downloaded to `data/media`.
- Raw network payloads are saved in `data/raw-events.json` when JSON fallback is active.

## Local API

The tool exposes a local API that the Web UI uses to read threads, messages, attachments, plugins, and source code.

Endpoints:

- `GET /api/threads`
- `GET /api/messages?threadId=...`
- `GET /api/attachments?threadId=...`
- `GET /api/plugins`
- `GET /api/replay?threadId=...`
- `GET /api/source/list`
- `GET /api/source?path=...`
- `POST /api/source`

## Web UI

Visit the local API server in your browser to:

- Browse captured thread history
- Inspect message JSON
- Preview attachments
- Load plugins
- Edit frontend source code live

## Plugin system

Plugins live in the `plugins/` folder. Each plugin defines metadata in JSON and may include a code file.

The server watches the plugin folder and reloads plugin definitions automatically.

## Troubleshooting

- If the browser fails to launch, ensure Playwright is installed with `npx playwright install`.
- If captures fail due to login, open the browser and sign in to Facebook Messenger manually.
- If schema warnings appear, the GraphQL payload shape has changed. The tool logs drift warnings and preserves raw payloads.

## Known limitations

- This tool assumes a single-thread capture session and may need custom thread IDs for complex accounts.
- Replay support reconstructs chronology from stored messages; edit and reaction replay is based on available payload fields.
- Live capture uses a fixed timeout and may need additional tuning for long running sessions.
