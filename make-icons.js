// Generates icon-192.png, icon-512.png, apple-touch-icon.png
// Design: gold crypto-style B on white background

const sharp = require('sharp');
const path  = require('path');
const OUT   = __dirname;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Gold gradient across the full B height (userSpaceOnUse so all shapes share it) -->
    <linearGradient id="gB" gradientUnits="userSpaceOnUse" x1="200" y1="88" x2="340" y2="460">
      <stop offset="0%"   stop-color="#f8d060"/>
      <stop offset="45%"  stop-color="#c9a028"/>
      <stop offset="100%" stop-color="#7a4510"/>
    </linearGradient>

    <!-- Soft gold glow -->
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- White background -->
  <rect width="512" height="512" rx="88" fill="#ffffff"/>

  <!-- Subtle warm border -->
  <rect x="3" y="3" width="506" height="506" rx="86" fill="none" stroke="#e0cdb0" stroke-width="5"/>

  <!-- Gold B with glow -->
  <g filter="url(#glow)">
    <!-- Vertical spine -->
    <rect x="140" y="88" width="68" height="372" rx="10" fill="url(#gB)"/>

    <!-- Upper bump (D shape, outer) -->
    <path d="M 204,88
             C 318,88 370,126 370,188
             C 370,250 318,272 204,272 Z"
          fill="url(#gB)"/>

    <!-- Lower bump (D shape, outer — slightly wider) -->
    <path d="M 204,272
             C 326,272 386,314 386,368
             C 386,422 326,460 204,460 Z"
          fill="url(#gB)"/>

    <!-- Bitcoin-style crossbars -->
    <rect x="116" y="80"  width="108" height="22" rx="7" fill="url(#gB)"/>
    <rect x="116" y="261" width="100" height="18" rx="6" fill="url(#gB)"/>
    <rect x="116" y="450" width="108" height="22" rx="7" fill="url(#gB)"/>
  </g>

  <!-- White interior cutouts (drawn after glow so they're clean) -->
  <!-- Upper inner D -->
  <path d="M 204,133
           C 282,133 318,156 318,188
           C 318,220 282,238 204,238 Z"
        fill="#ffffff"/>

  <!-- Lower inner D -->
  <path d="M 204,314
           C 296,314 336,338 336,368
           C 336,398 296,422 204,422 Z"
        fill="#ffffff"/>
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
