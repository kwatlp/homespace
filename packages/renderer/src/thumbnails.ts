/** Width (px) of generated card/gallery thumbnails. */
export const THUMB_WIDTH = 640;

/** Raster image extensions sharp can downscale (SVG is left as-is). */
export function isRasterImage(pathname: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(pathname);
}

/** Resize an image buffer to a target width; used by writeDist when present. */
export type Thumbnailer = (input: Uint8Array, width: number) => Promise<Uint8Array>;

/**
 * Try to build a sharp-backed thumbnailer. Returns null when sharp isn't
 * installed — thumbnails are an optional optimization and the build degrades
 * gracefully to full-size images (TDD §5.4, §6.1). The module specifier is
 * indirected through a variable so a missing optional dep doesn't break the
 * type-check or a bundler.
 */
export async function loadSharpThumbnailer(): Promise<Thumbnailer | null> {
  const moduleName: string = "sharp";
  try {
    const mod = (await import(moduleName)) as {
      default: (input: Uint8Array) => {
        resize(opts: { width: number; withoutEnlargement: boolean }): { toBuffer(): Promise<Buffer> };
      };
    };
    const sharp = mod.default;
    return async (input, width) => sharp(input).resize({ width, withoutEnlargement: true }).toBuffer();
  } catch {
    return null;
  }
}
