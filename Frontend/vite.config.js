import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    /**
     * Never inline an asset as a base64 data URI. Vite's default is 4096 bytes.
     *
     * This is not a style preference — inlining is actively wrong once `<picture>` serves
     * more than one format. An inlined AVIF lives inside the JS bundle that **every**
     * browser downloads, so a browser that would have picked the WebP still pays for the
     * AVIF bytes it will never decode. The whole point of offering formats is that a client
     * fetches exactly one of them.
     *
     * It surfaced when AVIF landed: the new derivatives were small enough to fall under the
     * threshold, six AVIF and two WebP files moved into the bundle, and gzipped JS went from
     * 104 kB to 122 kB — over budget — while the images they replaced were still emitted as
     * files for the browsers that need them.
     *
     * base64 is also ~33% larger than the bytes it encodes, and an inlined asset cannot be
     * cached separately from the code around it.
     */
    assetsInlineLimit: 0,
  },
})
