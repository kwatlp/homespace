/**
 * The base stylesheet. Consumes theme tokens exclusively (via CSS custom
 * properties from tokens.css), so restyling a node means editing tokens, never
 * this file (TDD §6.1). No external requests; ships in dist verbatim.
 */
export const BASE_CSS = `*, *::before, *::after { box-sizing: border-box; }

html { font-size: calc(100% * var(--font-scale, 1)); }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: 1.6;
}

.wrap {
  max-width: var(--max-width);
  margin-inline: auto;
  padding-inline: calc(var(--space-unit) * 3);
}

a { color: var(--color-accent); }
a:focus-visible, button:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}

.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: calc(var(--space-unit) * 2);
  top: calc(var(--space-unit) * 2);
  z-index: 10;
  background: var(--color-surface);
  padding: calc(var(--space-unit) * 1) calc(var(--space-unit) * 2);
  border-radius: var(--radius);
}

.site-header {
  border-bottom: 1px solid var(--color-surface);
}
.site-header .wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: calc(var(--space-unit) * 2);
  padding-block: calc(var(--space-unit) * 2);
}
.site-title { font-family: var(--font-display); font-size: 1.4rem; margin: 0; }
.site-nav { margin-left: auto; }
.site-nav ul { display: flex; gap: calc(var(--space-unit) * 2); list-style: none; margin: 0; padding: 0; }

section.section { padding-block: calc(var(--space-unit) * 6); }
section.section > .wrap > h2 {
  font-family: var(--font-display);
  margin-top: 0;
}

.hero { text-align: center; }
.hero h1 { font-family: var(--font-display); font-size: clamp(2rem, 6vw, 3.2rem); margin-bottom: calc(var(--space-unit) * 1); }
.hero p { color: var(--color-muted); font-size: 1.2rem; }
.hero img { max-width: 100%; height: auto; border-radius: var(--radius); }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: calc(var(--space-unit) * 3); }
.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.card img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
.card .card-body { padding: calc(var(--space-unit) * 2); }
.card h3 { margin: 0 0 calc(var(--space-unit) * 1); font-size: 1.1rem; }
.card p { margin: 0; color: var(--color-muted); }
.card a.card-link::after { content: ""; position: absolute; inset: 0; }
.card { position: relative; }

ul.links, ul.feed { list-style: none; margin: 0; padding: 0; display: grid; gap: calc(var(--space-unit) * 2); }
ul.links li, ul.feed li { background: var(--color-surface); border-radius: var(--radius); padding: calc(var(--space-unit) * 2); }

.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: calc(var(--space-unit) * 2); }
.gallery img { width: 100%; height: auto; border-radius: var(--radius); }

.prose { max-width: 68ch; }
.prose img { max-width: 100%; height: auto; }

.site-footer {
  border-top: 1px solid var(--color-surface);
  color: var(--color-muted);
  padding-block: calc(var(--space-unit) * 4);
}

.tag { color: var(--color-muted); font-size: 0.85rem; }

.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: calc(var(--space-unit) * 3); }
.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 128px;
  padding: calc(var(--space-unit) * 2);
  background: var(--color-surface);
  border-radius: var(--radius);
  font-family: var(--font-display);
  font-size: 1.2rem;
  text-align: center;
  text-decoration: none;
  color: var(--color-text);
}

.embed { border-radius: var(--radius); }
`;
