# Manual Test Checklist

These checks validate end-to-end behavior that requires a browser and wallet.

## Setup
1. Start server: `node server.js`
2. Open `http://localhost:8001`

## Wallet / Auth
- Connect wallet with the **Connect Wallet** button.
- Confirm address and status update in the wallet section.
- Toggle **Details** and verify auth debug controls appear.
- Use **Reset Wallet Selection** and reconnect.

## Deploy (optional)
- Switch to **Deploy Contract**.
- Attempt a deploy in your target mode (if appropriate for your environment).

## Mint / Inscribe
- Go to **Mint Mode**.
- Drop a small file and confirm:
  - Preview renders (image/audio/video/html/text).
  - Chunk count and root appear in the mint summary.
- Start **Begin Inscription** (wallet prompts expected).
- If interrupted, re-select the same file and verify **Resume Inscription** flow.

## Viewer
- Switch to **Inscription Viewer**.
- Load a known ID and verify rendering.
- For audio: confirm decode and play/stop.
- For HTML/PDF: confirm iframe rendering.
- Use **Clear** and confirm viewer resets.

## Regression checks
- Toggle **Safe Mode** and confirm behavior messaging updates.
- Use **Fetch Fee Rates** and confirm estimate text updates.
- Refresh the page and ensure UI defaults load without errors.
