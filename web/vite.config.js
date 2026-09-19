import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the static export works from any path (GitHub Pages, a USB stick, a laptop).
//
// Chunking uses rolldown's `output.codeSplitting` (Vite 8 does not translate rollup's manualChunks).
// Groups are matched in priority order; a module lands in the first group that captures it, together
// with its node_modules dependencies (includeDependenciesRecursively), so:
//   react   react, react-dom, scheduler: stable across app edits, cached between deploys
//   plotly  plotly.js-cartesian-dist-min (4.8 MB minified): referenced only by the dynamic import in
//           src/charts/Plot.jsx, so it downloads only when a chart mounts (the region heatmap)
//   globe   three, three-globe, react-globe.gl and their d3/kapsule helpers: statically imported by
//           the shell, needed on every page, one file so it caches as one
//   ui      cmdk (+ radix), dnd-kit
// Everything else (app code, topojson-client, small helpers) follows rolldown's automatic splitting;
// world-atlas / us-atlas JSON are already their own chunks behind dynamic imports in globe/land.js.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174 },
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: true,
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'plotly', test: /[\\/]node_modules[\\/]plotly\.js-dist-min[\\/]/, priority: 30 },
            { name: 'globe', test: /[\\/]node_modules[\\/](three|three-globe|react-globe\.gl|globe\.gl|three-render-objects|three-conic-polygon-geometry|three-geojson-geometry|three-slippy-map-globe)[\\/]/, priority: 20 },
            { name: 'ui', test: /[\\/]node_modules[\\/](cmdk|@dnd-kit|@radix-ui)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
