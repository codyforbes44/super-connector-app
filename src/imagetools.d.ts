/// <reference types="vite-imagetools/client" />

// vite-imagetools' bundled types only cover a fixed set of query strings.
// Our marketing images use custom width/format combinations, so declare the
// generic shapes: `as=srcset` yields a srcset string, everything else a URL.
declare module "*&as=srcset" {
  const srcset: string;
  export default srcset;
}

declare module "*&format=webp" {
  const src: string;
  export default src;
}
