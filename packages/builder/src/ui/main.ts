/**
 * The Builder page's glue: wizard answers in, live preview and two downloads
 * out. Everything happens in this tab — no network, no account, no upload
 * (TDD §15.1). Hand-rolled, per house style; the only "framework" is the DOM.
 */
import { buildInMemory, type BuiltFile } from "../build.js";
import { masterZip, websiteZip } from "../download.js";
import { previewDocument } from "../preview.js";
import {
  composeHomespace,
  defaultWizardState,
  slugify,
  SPACE_LABELS,
  type SpaceType,
  type WizardState,
} from "../wizard.js";

const SPACE_BLURBS: Record<SpaceType, string> = {
  art: "Pictures, shown as a gallery.",
  writing: "Posts, newest first, with a feed people can follow.",
  games: "Things that play in the browser.",
  apps: "Small tools and toys.",
  links: "Places you want people to go, with room to say why.",
};

const LAYOUTS: { value: WizardState["layout"]; label: string; blurb: string }[] = [
  { value: "scroll", label: "One long page", blurb: "Everything on the front page, top to bottom." },
  { value: "pages", label: "Separate pages", blurb: "Each part gets its own page, with a menu across the top." },
  { value: "grid", label: "A front door", blurb: "The front page is a grid of tiles leading into each part." },
];

const COLOURS: { key: keyof WizardState["theme"]; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "surface", label: "Cards" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Quiet text" },
  { key: "accent", label: "Highlights" },
];

const MIME: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain",
  md: "text/markdown",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  ico: "image/x-icon",
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the Builder page is missing #${id}`);
  return node as T;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Preview assets travel as `data:` URLs so the preview frame can stay strictly
 * sandboxed — an opaque origin cannot read a blob URL minted by this page, and
 * we would rather keep the sandbox than relax it (TDD §6.4).
 */
function dataUrl(file: BuiltFile): string {
  const extension = /\.([a-z0-9]+)$/i.exec(file.path)?.[1]?.toLowerCase() ?? "";
  return `data:${MIME[extension] ?? "application/octet-stream"};base64,${base64(file.bytes)}`;
}

async function readAsset(file: File): Promise<{ name: string; bytes: Uint8Array }> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

function start(): void {
  const state: WizardState = defaultWizardState(new Date().toISOString());
  let slugTouched = false;
  let redrawTimer: number | undefined;

  // ── Step 2: the spaces on offer, straight from the wizard's own list ──
  const spaces = el<HTMLUListElement>("spaces");
  for (const space of Object.keys(SPACE_LABELS) as SpaceType[]) {
    const item = document.createElement("li");
    item.innerHTML =
      `<label><input type="checkbox" value="${space}">` +
      `<span><span class="what">${SPACE_LABELS[space]}</span>` +
      `<span class="hint">${SPACE_BLURBS[space]}</span></span></label>`;
    spaces.append(item);
  }

  const layouts = el<HTMLUListElement>("layouts");
  for (const layout of LAYOUTS) {
    const item = document.createElement("li");
    item.innerHTML =
      `<label><input type="radio" name="layout" value="${layout.value}"${layout.value === state.layout ? " checked" : ""}>` +
      `<span><span class="what">${layout.label}</span><span class="hint">${layout.blurb}</span></span></label>`;
    layouts.append(item);
  }

  const colours = el<HTMLDivElement>("colours");
  for (const colour of COLOURS) {
    const wrap = document.createElement("label");
    wrap.className = "swatch";
    wrap.innerHTML =
      `<input type="color" data-colour="${colour.key}" value="${String(state.theme[colour.key])}">` +
      `<span>${colour.label}</span>`;
    colours.append(wrap);
  }

  // ── Fields ──
  const title = el<HTMLInputElement>("title");
  const tagline = el<HTMLInputElement>("tagline");
  const slug = el<HTMLInputElement>("slug");
  const lang = el<HTMLInputElement>("lang");
  const footer = el<HTMLInputElement>("footer");
  const radius = el<HTMLInputElement>("radius");
  const maxWidth = el<HTMLInputElement>("maxWidth");
  const fontScale = el<HTMLInputElement>("fontScale");
  const postTitle = el<HTMLInputElement>("postTitle");
  const postBody = el<HTMLTextAreaElement>("postBody");
  const status = el<HTMLParagraphElement>("status");
  const stage = el<HTMLDivElement>("stage");
  const preview = el<HTMLIFrameElement>("preview");

  title.value = state.title;
  slug.value = state.slug;
  lang.value = state.lang;
  radius.value = String(state.theme.radius);
  maxWidth.value = String(state.theme.maxWidth);
  fontScale.value = String(state.theme.fontScale);

  const say = (message: string, tone: "ok" | "bad" = "ok"): void => {
    status.textContent = message;
    status.dataset["tone"] = tone;
  };

  /** Show only the fields that belong to a chosen space. */
  function syncVisibility(): void {
    for (const node of document.querySelectorAll<HTMLElement>("[data-space]")) {
      const space = node.dataset["space"] as SpaceType;
      node.hidden = !state.spaces.includes(space);
    }
  }

  async function redraw(): Promise<void> {
    const { homespace, tree } = composeHomespace(state);
    const built = await buildInMemory({ homespace, tree });
    if (!built.ok) {
      say(built.errors[0] ?? "Something in these answers does not build yet.", "bad");
      return;
    }
    preview.srcdoc = previewDocument(built.files, (path) => {
      const file = built.files.find((f) => f.path === path);
      return file === undefined ? path : dataUrl(file);
    });
    if (status.dataset["tone"] === "bad") say("");
  }

  function schedule(): void {
    syncVisibility();
    if (redrawTimer !== undefined) window.clearTimeout(redrawTimer);
    redrawTimer = window.setTimeout(() => void redraw(), 180);
  }

  // ── Wiring ──
  title.addEventListener("input", () => {
    state.title = title.value;
    if (!slugTouched) {
      state.slug = slugify(title.value);
      slug.value = state.slug;
    }
    schedule();
  });
  slug.addEventListener("input", () => {
    slugTouched = true;
    state.slug = slugify(slug.value);
    schedule();
  });
  tagline.addEventListener("input", () => {
    state.tagline = tagline.value;
    schedule();
  });
  lang.addEventListener("input", () => {
    state.lang = lang.value.trim() || "en";
    schedule();
  });
  footer.addEventListener("input", () => {
    state.footer = footer.value;
    schedule();
  });

  spaces.addEventListener("change", () => {
    state.spaces = [...spaces.querySelectorAll<HTMLInputElement>("input:checked")].map(
      (input) => input.value as SpaceType,
    );
    schedule();
  });

  layouts.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    state.layout = input.value as WizardState["layout"];
    schedule();
  });

  colours.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    const key = input.dataset["colour"] as "bg" | "surface" | "text" | "muted" | "accent";
    state.theme[key] = input.value;
    schedule();
  });

  radius.addEventListener("input", () => {
    state.theme.radius = Number(radius.value);
    schedule();
  });
  maxWidth.addEventListener("input", () => {
    state.theme.maxWidth = Number(maxWidth.value);
    schedule();
  });
  fontScale.addEventListener("input", () => {
    state.theme.fontScale = Number(fontScale.value);
    schedule();
  });

  const syncPost = (): void => {
    state.post = { title: postTitle.value, body: postBody.value };
    schedule();
  };
  postTitle.addEventListener("input", syncPost);
  postBody.addEventListener("input", syncPost);

  el<HTMLInputElement>("icon").addEventListener("change", (event) => {
    void (async () => {
      const [file] = (event.target as HTMLInputElement).files ?? [];
      if (file) state.icon = await readAsset(file);
      schedule();
    })();
  });
  el<HTMLInputElement>("banner").addEventListener("change", (event) => {
    void (async () => {
      const [file] = (event.target as HTMLInputElement).files ?? [];
      if (file) state.banner = await readAsset(file);
      schedule();
    })();
  });
  el<HTMLInputElement>("gallery").addEventListener("change", (event) => {
    void (async () => {
      const files = [...((event.target as HTMLInputElement).files ?? [])];
      state.gallery = await Promise.all(files.map(readAsset));
      schedule();
    })();
  });
  el<HTMLInputElement>("build").addEventListener("change", (event) => {
    void (async () => {
      const files = [...((event.target as HTMLInputElement).files ?? [])];
      state.build = await Promise.all(files.map(readAsset));
      if (state.build.length > 0 && !state.build.some((f) => f.name === "index.html")) {
        say("That folder has no index.html, so there is nothing to launch. The placeholder stays for now.", "bad");
        state.build = [];
      }
      schedule();
    })();
  });

  // ── Links ──
  const links = el<HTMLDivElement>("links");
  function addLinkRow(): void {
    const index = links.children.length;
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML =
      `<label class="hint" for="linkLabel${index}">What is it called?</label>` +
      `<input id="linkLabel${index}" type="text" data-link="label" autocomplete="off">` +
      `<label class="hint" for="linkUrl${index}">Web address</label>` +
      `<input id="linkUrl${index}" type="url" data-link="url" inputmode="url" placeholder="https://">`;
    links.append(row);
  }
  addLinkRow();
  el<HTMLButtonElement>("addLink").addEventListener("click", () => {
    addLinkRow();
    schedule();
  });
  links.addEventListener("input", () => {
    state.links = [...links.querySelectorAll<HTMLDivElement>(".link-row")]
      .map((row) => ({
        label: row.querySelector<HTMLInputElement>('[data-link="label"]')?.value ?? "",
        url: row.querySelector<HTMLInputElement>('[data-link="url"]')?.value ?? "",
      }))
      .filter((link) => link.url.trim() !== "");
    schedule();
  });

  // ── Preview width ──
  const phone = el<HTMLButtonElement>("viewPhone");
  const desktop = el<HTMLButtonElement>("viewDesktop");
  const setViewport = (isPhone: boolean): void => {
    stage.classList.toggle("is-phone", isPhone);
    phone.setAttribute("aria-pressed", String(isPhone));
    desktop.setAttribute("aria-pressed", String(!isPhone));
  };
  phone.addEventListener("click", () => setViewport(true));
  desktop.addEventListener("click", () => setViewport(false));

  // ── Downloads ──
  function offer(bytes: Uint8Array, filename: string): void {
    // Copy into a plain ArrayBuffer: a Uint8Array may be backed by a shared
    // one, which Blob will not take.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before letting it go.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  const siteButton = el<HTMLButtonElement>("downloadSite");
  siteButton.addEventListener("click", () => {
    void (async () => {
      siteButton.disabled = true;
      say("Building…");
      try {
        const download = await websiteZip(state);
        if (!download.ok) {
          say(download.errors[0] ?? "That did not build.", "bad");
          return;
        }
        offer(download.zip, download.filename);
        say(`Saved ${download.filename}. Unzip it into your host and you are live.`);
      } finally {
        siteButton.disabled = false;
      }
    })();
  });

  el<HTMLButtonElement>("downloadMaster").addEventListener("click", () => {
    const download = masterZip(state);
    offer(download.zip, download.filename);
    say(`Saved ${download.filename}. Keep this one — it is how you change things later.`);
  });

  syncVisibility();
  void redraw();
}

start();
