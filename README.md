# Captcha Reader (Chrome Extension)

Right-click a captcha image, choose **“Read Captcha”**, and the extension runs on-device OCR (Tesseract.js) to extract digits and copy them to your clipboard. All processing stays local — no images or text are sent to servers.

## Features
- Context menu entry: **Read Captcha** on any image
- Local OCR with Tesseract.js (digits only, faster & private)
- Bundled worker and WASM (MV3-safe, no remote code)
- In-page toast feedback; copies numbers to clipboard automatically
- Works in incognito (enable “Allow in Incognito” in Chrome)

## Installation (Unpacked)
1. Download/clone this repo.
2. Open `chrome://extensions` → enable **Developer mode**.
3. Click **Load unpacked** → select this folder.
4. (Optional) Enable **Allow in Incognito** for incognito usage.

## Usage
1. Right-click a captcha image → **Read Captcha**.
2. Wait for the toast (“Copied: 123456”).
3. Paste into the target input.

## Permissions Explained
- `contextMenus`: Add the “Read Captcha” item.
- `activeTab` + `scripting`: Temporarily access the current tab when you click the menu.
- `clipboardWrite`: Copy recognized digits to your clipboard.

## Privacy
- No data collection, storage, or transmission.
- OCR runs locally in your browser (Tesseract.js, WebAssembly).
- No remote code loading; worker and core are bundled (`worker.min.js`, `tesseract-core.wasm.js`).

## Files of Interest
- `manifest.json` — MV3 config, web_accessible resources for worker/WASM.
- `background.js` — Context menu + script injection on click.
- `content.js` — OCR flow, image preprocessing, toasts, clipboard copy.
- `worker.min.js`, `tesseract-core.wasm.js` — Bundled Tesseract worker/core.
- `privacy.html` — Published privacy policy.

## Troubleshooting
- **Content script not found / no response:** Refresh the page and try again; the background injects scripts on click.
- **Incognito:** Enable “Allow in Incognito” in `chrome://extensions`.
- **Slow first run:** The worker initializes on first use; subsequent runs are faster.

## License
MIT — see `LICENSE`.

