import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cornerstone's DICOM loader ships a web worker, so it is not pre-bundled. Its dependencies are:
  // the CommonJS codecs and parser so the browser can import them as ES modules, and the shared
  // metadata/utils packages so the loader and core use one instance (otherwise DICOM files load
  // their metadata into a registry core never reads).
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
    include: [
      '@cornerstonejs/metadata',
      '@cornerstonejs/utils',
      'dicom-parser',
      'pako',
      'comlink',
      '@cornerstonejs/codec-charls/decodewasmjs',
      '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs',
      '@cornerstonejs/codec-libjxl/decodewasmjs',
      '@cornerstonejs/codec-openjpeg/decodewasmjs',
      '@cornerstonejs/codec-openjph/wasmjs',
    ],
  },
  worker: {
    format: 'es',
  },
})
