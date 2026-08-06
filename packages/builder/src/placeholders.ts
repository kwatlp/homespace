/**
 * Neutral stand-ins for anything the person skipped (TDD §15.3). Plain
 * geometry in the homespace's own colors — no studio branding, nothing that
 * looks like a logo, nothing to feel embarrassed about leaving in place for a
 * while. SVG text, so a starter homespace carries no binary payload.
 */

export interface PlaceholderColors {
  bg: string;
  surface: string;
  muted: string;
  accent: string;
}

function svg(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" role="img">\n${body}\n</svg>\n`
  );
}

/** A wide banner: soft bands, nothing to read. */
export function placeholderBanner(colors: PlaceholderColors): string {
  return svg(
    1200,
    400,
    [
      `  <rect width="1200" height="400" fill="${colors.surface}"/>`,
      `  <circle cx="240" cy="200" r="150" fill="${colors.accent}" opacity="0.28"/>`,
      `  <circle cx="470" cy="200" r="150" fill="${colors.muted}" opacity="0.18"/>`,
      `  <rect x="0" y="330" width="1200" height="70" fill="${colors.bg}" opacity="0.5"/>`,
    ].join("\n"),
  );
}

/** A square stand-in for a picture; `index` varies the geometry a little. */
export function placeholderArt(colors: PlaceholderColors, index: number): string {
  const shapes = [
    `  <circle cx="400" cy="400" r="220" fill="${colors.accent}" opacity="0.35"/>`,
    `  <rect x="180" y="180" width="440" height="440" rx="40" fill="${colors.accent}" opacity="0.3"/>`,
    `  <polygon points="400,150 650,650 150,650" fill="${colors.accent}" opacity="0.32"/>`,
  ];
  return svg(
    800,
    800,
    [
      `  <rect width="800" height="800" fill="${colors.surface}"/>`,
      shapes[index % shapes.length]!,
      `  <circle cx="${260 + (index % 3) * 140}" cy="300" r="90" fill="${colors.muted}" opacity="0.22"/>`,
    ].join("\n"),
  );
}

/** A small mark for the browser tab. */
export function placeholderIcon(colors: PlaceholderColors): string {
  return svg(
    64,
    64,
    [
      `  <rect width="64" height="64" rx="14" fill="${colors.surface}"/>`,
      `  <circle cx="32" cy="32" r="16" fill="${colors.accent}"/>`,
    ].join("\n"),
  );
}

/**
 * A starter web toy for a games/apps space: a keyboard- and touch-reachable
 * page with no external requests, so the space plays from the first build.
 */
export function placeholderWebBuild(title: string, colors: PlaceholderColors): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center;
    background: ${colors.bg}; color: ${colors.muted};
    font: 1rem/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    text-align: center; padding: 1.5rem;
  }
  button {
    font: inherit; margin-top: 1rem; padding: 0.75rem 1.5rem; border: 0;
    border-radius: 10px; background: ${colors.accent}; color: ${colors.bg};
    cursor: pointer; min-height: 44px;
  }
  output { display: block; margin-top: 1rem; font-size: 2rem; color: ${colors.accent}; }
</style>
</head>
<body>
<main>
  <p>This is where your build runs.<br>Replace this folder's files with your own.</p>
  <button type="button" id="tap">Tap me</button>
  <output id="count" aria-live="polite">0</output>
</main>
<script>
  var n = 0;
  document.getElementById("tap").addEventListener("click", function () {
    n += 1;
    document.getElementById("count").textContent = String(n);
  });
</script>
</body>
</html>
`;
}
