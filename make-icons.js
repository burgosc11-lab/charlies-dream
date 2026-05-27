// Generates icon-192.png, icon-512.png, apple-touch-icon.png
// Design: terminal mark — teal > prompt + coral cursor block on dark bg

const sharp = require('sharp');
const path  = require('path');
const OUT   = __dirname;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">

  <!-- Dark terminal background -->
  <rect width="512" height="512" rx="88" fill="#111111"/>

  <!-- Teal > chevron (drawn as path — no font dependency) -->
  <polyline
    points="78,124 258,256 78,388"
    fill="none"
    stroke="#4ecfb0"
    stroke-width="44"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Coral cursor block -->
  <rect x="296" y="138" width="132" height="196" rx="6" fill="#d4522a"/>

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
