/**
 * `homespace-zip` is isomorphic: it compiles with `types: []` so a stray
 * `node:*` import fails the build rather than passing silently. `TextEncoder`
 * is a WHATWG global that both Node and browsers provide, so declare just the
 * sliver of it this package uses.
 */
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
