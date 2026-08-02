# archetypes/

Presets a creator copies with `kwatlp init <archetype>`. An archetype is exactly
one annotated `node.manifest.jsonc` + `theme/` defaults (OFL-licensed fonts,
vendored) + 2–4 sample packs + a `THEME.md` documenting every exposed variable
in designer language. Nothing else.

v0 ships four (TDD §8); they land in **WO-7**:

| Archetype | Layout | Focus |
|---|---|---|
| `link-hub` | scroll | linktree-with-depth; adoption entry point |
| `author` | pages | writing-first; RSS on |
| `illustrator` | grid | image-first; gallery + lightbox |
| `game-designer` | scroll | playable games/apps + dev log |

Empty until WO-7. See `internal-docs/KwatlpTDD.md` §8.
