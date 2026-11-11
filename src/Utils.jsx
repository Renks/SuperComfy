
// ============================================================================
// 3. HELPER UTILITIES & SANDBOX SVG GENERATOR (Supports Batch Previews)
// ============================================================================
function generateClientId() {
  return 'cp-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

function detectMediaCategory(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return 'video';
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.flac')) return 'audio';
  if (lower.endsWith('.gif')) return 'gif';
  return 'image';
}

function createSimulatedBatchSvgUrl({ promptText, seed, batchIndex, batchTotal, width, height }) {
  const hues = [160, 200, 270, 330];
  const hue1 = (Number(seed || 1) + batchIndex * 47) % 360;
  const hue2 = hues[batchIndex % hues.length];
  const safePrompt = String(promptText || 'Editorial portrait')
    .replace(/[<>&"']/g, '')
    .slice(0, 65);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 65%, 14%)" />
        <stop offset="55%" stop-color="#09090b" />
        <stop offset="100%" stop-color="hsl(${hue2}, 75%, 18%)" />
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)" />
    <circle cx="${260 + batchIndex * 80}" cy="210" r="140" fill="hsl(${hue2}, 80%, 45%)" opacity="0.16" />
    <rect x="36" y="36" width="728" height="428" rx="22" fill="none" stroke="#10b981" stroke-opacity="0.35" stroke-width="2" />
    <text x="64" y="88" fill="#10b981" font-family="monospace" font-size="18" font-weight="bold">
      comfy_outputs/ • BATCH ITEM ${batchIndex + 1} OF ${batchTotal}
    </text>
    <text x="64" y="124" fill="#e4e4e7" font-family="sans-serif" font-size="22" font-weight="bold">
      Z-Image Turbo (${width}×${height})
    </text>
    <text x="64" y="164" fill="#a1a1aa" font-family="monospace" font-size="15">
      Seed: ${seed}
    </text>
    <text x="64" y="410" fill="#d4d4d8" font-family="sans-serif" font-size="15">
      "${safePrompt}..."
    </text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// let's export the utility functions so they can be imported and used in other parts of the application.
export { generateClientId, detectMediaCategory, createSimulatedBatchSvgUrl };