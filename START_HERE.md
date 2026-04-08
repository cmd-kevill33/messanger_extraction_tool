# START HERE

Welcome to `messanger_extraction_tool` — the local Messenger single-thread extraction and replay tool.

## 1. Install prerequisites

- Node.js 20+ is required.
- Git is recommended if you cloned the repository.

## 2. Install dependencies

Run:

```bash
npm install
```

## 3. Install Playwright browsers

Run:

```bash
npx playwright install
```

## 4. Run setup script

On macOS/Linux:

```bash
bash ./setup.sh
```

On Windows PowerShell:

```powershell
pwsh ./setup.ps1
```

## 5. Start a capture session

Capture a specific thread:

```bash
npm run dev -- capture --thread-id YOUR_THREAD_ID --full-history
```

Select a thread interactively:

```bash
npm run dev -- capture --select-thread
```

Enable live capture:

```bash
npm run dev -- capture --thread-id YOUR_THREAD_ID --live
```

## 6. Launch the local API server

```bash
npm run dev -- serve --port 4000
```

## 7. Open the Web UI

Open the local UI by visiting:

```text
http://127.0.0.1:4000
```

Or use the CLI:

```bash
npm run dev -- ui --api-url http://127.0.0.1:4000
```

## 8. Customize the UI

- Add plugin files to `plugins/`.
- Use the source panel in the Web UI to inspect and edit frontend code.
- Reload the UI with the `Reload UI` button.
