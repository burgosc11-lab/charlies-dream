// Generates icon-192.png, icon-512.png, apple-touch-icon.png
// Design: rising dividend bars + gold trend line on dark warm background

const sharp = require('sharp');
const path  = require('path');
const OUT   = __dirname;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Deep warm dark background -->
    <radialGradient id="bg" cx="38%" cy="32%" r="75%">
      <stop offset="0%"   stop-color="#2e1608"/>
      <stop offset="100%" stop-color="#090402"/>
    </radialGradient>

    <!-- Gold gradient for bars -->
    <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#f5c84a"/>
      <stop offset="100%" stop-color="#8a5510"/>
    </linearGradient>

    <!-- Horizontal shimmer for accent lines -->
    <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#c9952a" stop-opacity="0"/>
      <stop offset="35%"  stop-color="#f0c050" stop-opacity="0.9"/>
      <stop offset="65%"  stop-color="#f0c050" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#c9952a" stop-opacity="0"/>
    </linearGradient>

    <!-- Soft glow filter for trend line -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <!-- Subtle inner shadow for bars -->
    <filter id="barShadow">
      <feDropShadow dx="0" dy="-4" stdDeviation="6" flood-color="#f5c84a" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- ── BACKGROUND ── -->
  <rect width="512" height="512" rx="88" fill="url(#bg)"/>

  <!-- Subtle warm glow in top-left -->
  <ellipse cx="160" cy="160" rx="220" ry="180" fill="#c9952a" opacity="0.04"/>

  <!-- Top shimmer line -->
  <rect x="56" y="50" width="400" height="1.5" fill="url(#shimmer)" opacity="0.7"/>

  <!-- ── GRID LINES (very subtle) ── -->
  <line x1="64" y1="200" x2="448" y2="200" stroke="#c9952a" stroke-width="0.6" opacity="0.12"/>
  <line x1="64" y1="280" x2="448" y2="280" stroke="#c9952a" stroke-width="0.6" opacity="0.12"/>
  <line x1="64" y1="360" x2="448" y2="360" stroke="#c9952a" stroke-width="0.6" opacity="0.12"/>

  <!-- ── RISING BARS ── -->
  <!-- Bar 1 — shortest -->
  <rect x="66"  y="380" width="54" height="62" rx="7" fill="url(#barGold)" opacity="0.45" filter="url(#barShadow)"/>
  <!-- Bar 2 -->
  <rect x="146" y="320" width="54" height="122" rx="7" fill="url(#barGold)" opacity="0.58" filter="url(#barShadow)"/>
  <!-- Bar 3 -->
  <rect x="226" y="252" width="54" height="190" rx="7" fill="url(#barGold)" opacity="0.72" filter="url(#barShadow)"/>
  <!-- Bar 4 -->
  <rect x="306" y="194" width="54" height="248" rx="7" fill="url(#barGold)" opacity="0.87" filter="url(#barShadow)"/>
  <!-- Bar 5 — tallest, fully opaque -->
  <rect x="386" y="136" width="54" height="306" rx="7" fill="url(#barGold)" filter="url(#barShadow)"/>

  <!-- ── TREND LINE connecting bar tops ── -->
  <polyline
    points="93,380  173,320  253,252  333,194  413,136"
    stroke="#f5d060"
    stroke-width="7"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    opacity="0.95"
    filter="url(#glow)"
  />

  <!-- Dots at each top -->
  <circle cx="93"  cy="380" r="7"  fill="#f5d060" opacity="0.65"/>
  <circle cx="173" cy="320" r="7"  fill="#f5d060" opacity="0.78"/>
  <circle cx="253" cy="252" r="8"  fill="#f5d060" opacity="0.88"/>
  <circle cx="333" cy="194" r="9"  fill="#f5d060" opacity="0.94"/>
  <!-- Top dot — bright star -->
  <circle cx="413" cy="136" r="11" fill="#fff8d0"/>
  <circle cx="413" cy="136" r="7"  fill="#f5d060"/>

  <!-- ── BOTTOM ACCENT ── -->
  <rect x="56" y="460" width="400" height="1" fill="url(#shimmer)" opacity="0.45"/>

  <!-- ── "$ " dollar mark — subtle watermark top-left ── -->
  <text x="80" y="116"
        font-family="Georgia, serif"
        font-size="72"
        font-weight="bold"
        fill="#c9952a"
        opacity="0.22">$</text>
</svg>`;

async function make(svgStr, size, filename) {
  await sharp(Buffer.from(svgStr))
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, filename));
  console.log(`✓ ${filename}  (${size}×${size})`);
}

(async () => {
  await make(svg, 512, 'icon-512.png');
  await make(svg, 192, 'icon-192.png');
  await make(svg, 180, 'apple-touch-icon.png');
  console.log('\nAll icons generated.');
})().catch(e => { console.error(e.message); process.exit(1); });
