import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

// SoloBid logo: teal rounded-rect background + white FileText icon
// FileText lucide path: document with folded corner and lines
function makeSvg(size: number): string {
  const radius = Math.round(size * 0.22); // ~22% corner radius, matches app's rounded-xl
  const iconSize = Math.round(size * 0.5);
  const iconX = (size - iconSize) / 2;
  const iconY = (size - iconSize) / 2;
  const s = iconSize;

  // FileText lucide icon paths, scaled to iconSize×iconSize box starting at (iconX, iconY)
  // Original lucide viewBox is 24x24, scale factor = s/24
  const sc = s / 24;
  const ox = iconX;
  const oy = iconY;

  // Path 1: document outline with folded top-right corner
  // M4 2 ... (rect with corner fold)
  const docPath = `M${ox + 4*sc} ${oy + 2*sc}
    h${10*sc}
    l${4*sc} ${4*sc}
    v${14*sc}
    a${2*sc} ${2*sc} 0 0 1 -${2*sc} ${2*sc}
    H${ox + 4*sc}
    a${2*sc} ${2*sc} 0 0 1 -${2*sc} -${2*sc}
    V${oy + 4*sc}
    a${2*sc} ${2*sc} 0 0 1 ${2*sc} -${2*sc}z`;

  // Path 2: fold triangle
  const foldPath = `M${ox + 14*sc} ${oy + 2*sc} v${4*sc} h${4*sc}`;

  // Lines on the document
  const line1 = `M${ox + 8*sc} ${oy + 13*sc} h${8*sc}`;
  const line2 = `M${ox + 8*sc} ${oy + 17*sc} h${4*sc}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#088b7e"/>
  <path d="${docPath}" fill="none" stroke="white" stroke-width="${sc * 2}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${foldPath}" fill="none" stroke="white" stroke-width="${sc * 2}" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="${ox + 8*sc}" y1="${oy + 13*sc}" x2="${ox + 16*sc}" y2="${oy + 13*sc}" stroke="white" stroke-width="${sc * 2}" stroke-linecap="round"/>
  <line x1="${ox + 8*sc}" y1="${oy + 17*sc}" x2="${ox + 12*sc}" y2="${oy + 17*sc}" stroke="white" stroke-width="${sc * 2}" stroke-linecap="round"/>
</svg>`;
}

async function generate() {
  const publicDir = join(process.cwd(), 'public');

  for (const size of [192, 512]) {
    const svg = makeSvg(size);
    const svgBuffer = Buffer.from(svg);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();
    const outPath = join(publicDir, `icon-${size}.png`);
    writeFileSync(outPath, pngBuffer);
    console.log(`✓ public/icon-${size}.png (${pngBuffer.length} bytes)`);
  }
}

generate().catch(console.error);
