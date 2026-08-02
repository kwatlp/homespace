# archetypes/

Presets a creator copies with `homespace init <archetype>`. An archetype is
exactly one annotated `homespace.manifest.jsonc` + theme tokens + sample packs + a
`THEME.md` documenting every exposed variable in designer language.

v0 ships four (TDD §8):

| Archetype | Layout | Focus |
|---|---|---|
| `link-hub` | scroll | linktree-with-depth; adoption entry point |
| `author` | pages | writing-first; RSS on |
| `illustrator` | grid | image-first; gallery + lightbox |
| `game-designer` | scroll | playable games/apps + dev log |

Each builds to a complete, offline homespace with `homespace build`. Sample images are
SVGs so the presets ship zero external resources; fonts are left to the visitor's
system by default (self-host a `.woff2` in `theme/fonts/` to override — see each
archetype's `THEME.md`). See `internal-docs/HomespaceTDD.md` §8.
