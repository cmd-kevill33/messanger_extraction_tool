# messanger_extraction_tool

Orpheus Echo is a local Messenger thread extraction and replay tool that captures full thread history via browser network interception.

## Features

- Full-history Messenger thread capture via Facebook GraphQL / websocket events
- Live capture mode with incremental storage
- Attachment download queue with retry, integrity checking, and local media storage
- SQLite-backed structured storage with JSON fallback
- Express API server for local UI access
- React + Tailwind Web UI with conversation replay, source editing, and plugin support
- Thread selection via CLI or discovered thread list
- Integrity auditing and schema drift detection
- Plugin system for custom panels, themes, and transformations

## Tech stack

- Node.js + TypeScript
- Playwright for browser automation and interception
- SQLite via `better-sqlite3`
- Express local API server
- React / Vite / TailwindCSS for the Web UI
- Commander.js for CLI commands

## Getting started

```bash
npm install
npx playwright install
bash ./setup.sh
```

### Capture a thread

```bash
npm run dev -- capture --thread-id YOUR_THREAD_ID --full-history
```

### Run the local API

```bash
npm run dev -- serve --port 4000
```

### Open the UI

Open `http://127.0.0.1:4000` in your browser.

## Commands

- `orpheus-echo capture` - start collection of a Messenger thread
- `orpheus-echo audit` - run storage integrity checks
- `orpheus-echo serve` - run the API server and Web UI
- `orpheus-echo export` - export thread data to JSON or copy SQLite
- `orpheus-echo ui` - open the UI in a browser

## Documentation

See `START_HERE.md` and `docs/USER_GUIDE.md` for detailed workflows.

## Notes

The tool preserves raw events to support schema drift and stores structured data incrementally. If SQLite is unavailable, it automatically falls back to JSON storage.
