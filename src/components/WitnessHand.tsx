// The witness's hand — his signature under everything he writes. Gold, one
// line weight, and it faces the way the language reads: for Farsi it enters
// from the left and the pen stroke runs to the right.

export const WITNESS_HAND_PATHS = ["M24 307C137 309 218 300 304 281C351 270 393 257 429 235", "M422 240L552 85L575 104L449 258Z", "M552 85L566 68C572 61 583 60 589 66C596 72 596 82 590 89L575 104", "M422 240L410 272L449 258", "M414 262L429 269", "M462 218C482 199 500 189 521 190C543 191 566 210 592 231", "M481 213C490 225 500 238 514 247C524 253 535 249 535 239C535 228 525 215 516 205", "M506 201C520 214 532 226 548 235C559 241 569 237 568 226C567 216 553 205 541 197", "M534 196C548 205 562 215 578 220C590 224 599 217 594 207C589 197 576 190 564 184", "M563 184C590 189 613 203 637 222C658 239 681 250 706 257", "M468 218C457 223 448 227 438 231", "M590 89L599 80"];

export function WitnessHand({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 360"
      fill="none"
      aria-hidden
      className={"rtl:-scale-x-100 " + className}
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {WITNESS_HAND_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** The same hand as an SVG document string, for painting onto a canvas. */
export function witnessHandSvg(color: string, flip: boolean): string {
  const g = WITNESS_HAND_PATHS.map((d) => `<path d="${d}"/>`).join("");
  const t = flip ? ' transform="translate(720 0) scale(-1 1)"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" fill="none"><g${t} stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
}
