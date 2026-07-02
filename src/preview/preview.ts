/**
 *  Preview-webview entry point.  Currently: a temporary CSP probe (Task 2)
 *  that reports whether WebAssembly can instantiate inside the Markdown
 *  preview.  Replaced by the real hydrator in Task 7.
 */

/** The smallest valid wasm module: magic number + version, nothing else. */
const WASM_EMPTY = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

async function probe_wasm(): Promise<string> {
  try {
    await WebAssembly.instantiate(WASM_EMPTY);
    return 'WASM OK — @viz-js/viz can run in this webview';
  } catch (e) {
    return `WASM BLOCKED — ${(e as Error).message}`;
  }
}

async function show_probe(): Promise<void> {
  const box = document.createElement('div');
  box.style.cssText = 'border:2px solid orange; padding:8px; font-family:monospace;';
  box.textContent = `[vscode-fsl spike] ${await probe_wasm()}`;
  document.body.prepend(box);
}

void show_probe();
