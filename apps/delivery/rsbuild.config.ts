import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'delivery',
      exposes: { './App': './src/App.tsx' },
      // One React for the whole page: the shell's copy is used when hosted.
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
      dts: false,
    }),
  ],
  server: {
    port: 3002,
    // Dev only. In Docker, nginx serves the same /api paths.
    proxy: {
      '/api/people': { target: 'http://localhost:4001', pathRewrite: { '^/api/people': '' } },
      '/api/delivery': { target: 'http://localhost:4002', pathRewrite: { '^/api/delivery': '' } },
    },
  },
  // Assets load from wherever the remote is served, so one build works standalone and hosted.
  output: { assetPrefix: 'auto' },
  html: { title: 'Delivery' },
});
