import { escapeAttr, escapeHtml } from "./escape.js";

/**
 * iframe sandbox tokens for an embedded web build (TDD §6.4). Both modes allow
 * scripts, pointer lock, and fullscreen. **standard** additionally grants
 * allow-same-origin (Godot/Unity persistence need it); **strict** omits it,
 * giving the pack an opaque origin — recommend it for anything the operator
 * didn't author.
 */
export function sandboxTokens(sandbox: string | undefined): string {
  const base = "allow-scripts allow-pointer-lock allow-fullscreen";
  return sandbox === "strict" ? base : `${base} allow-same-origin`;
}

/**
 * A load-on-click player for a game/app web entry. The iframe is not created
 * until the visitor presses Play (no autoloading heavy WASM); a plain link is
 * the JavaScript-disabled fallback.
 */
export function renderPlayer(webUrl: string, sandbox: string | undefined): string {
  const url = escapeAttr(webUrl);
  const tokens = escapeAttr(sandboxTokens(sandbox));
  return (
    `<div class="player" data-src="${url}" data-sandbox="${tokens}">\n` +
    `  <div class="player-stage"><button type="button" class="player-play" aria-label="Play">▶ Play</button></div>\n` +
    `  <div class="player-controls">\n` +
    `    <button type="button" class="player-fullscreen">⛶ Fullscreen</button>\n` +
    `    <span class="tag">Gamepad supported</span>\n` +
    `    <noscript><a href="${url}">Open the build directly</a></noscript>\n` +
    `  </div>\n` +
    `</div>`
  );
}

/**
 * Inline player script (no external request). Wires load-on-click and
 * fullscreen for every .player on the page.
 */
export const PLAYER_SCRIPT = `<script>
(function () {
  document.querySelectorAll(".player").forEach(function (el) {
    var stage = el.querySelector(".player-stage");
    var play = el.querySelector(".player-play");
    if (play) play.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.className = "player-frame";
      frame.setAttribute("sandbox", el.dataset.sandbox);
      frame.setAttribute("allow", "fullscreen; gamepad");
      frame.src = el.dataset.src;
      stage.replaceChildren(frame);
      el.classList.add("is-playing");
    });
    var fs = el.querySelector(".player-fullscreen");
    if (fs) fs.addEventListener("click", function () {
      if (stage.requestFullscreen) stage.requestFullscreen();
    });
  });
})();
</script>`;

/** Render a download link with its rendered sha256 checksum, if any. */
export function renderDownload(downloadUrl: string, checksum: string | undefined): string {
  const sum = typeof checksum === "string"
    ? `<br><span class="tag">${escapeHtml(checksum)}</span>`
    : "";
  return `<p><a class="download" href="${escapeAttr(downloadUrl)}" download>Download</a>${sum}</p>`;
}
