# Devlog 1: getting started

Write up your progress as `post` packs. Games and apps are `game`/`app` packs
with an `entrypoint.web` (an `index.html`) — they play in-browser via a
load-on-click iframe. For builds you didn't author, set `"sandbox": "strict"`:
the build gets its own opaque origin and can't act as your site. See `THEME.md`.
