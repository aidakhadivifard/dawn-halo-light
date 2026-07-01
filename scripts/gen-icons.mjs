import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

const src = readFileSync("assets/logo-dawnhalo.svg", "utf8");

// icon-only.png: full icon WITH background, WITHOUT text
const iconOnly = src
  .replace(/<text[\s\S]*?<\/text>/, "");

// icon-foreground.png: just halo + sun on TRANSPARENT background
const iconFg = src
  .replace(/<text[\s\S]*?<\/text>/, "")
  .replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, "");

// icon-background.png: just the gradient background, no halo/sun/text
const iconBg = src
  .replace(/<text[\s\S]*?<\/text>/, "")
  .replace(/<circle[^>]*\/>/, "")
  .replace(/<g filter="url\(#haloGlow\)">[\s\S]*?<\/g>/, "")
  .replace(/<path d="M 564[^>]*\/>/, "");

function render(svg, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1024 },
    font: { loadSystemFonts: false },
  });
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

render(iconOnly, "assets/icon-only.png");
render(iconFg, "assets/icon-foreground.png");
render(iconBg, "assets/icon-background.png");
