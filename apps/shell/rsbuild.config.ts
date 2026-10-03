import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'shell',
      // No remotes here on purpose: their URLs come from /config.json at runtime, never from the bundle.
      remotes: {},
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
      dts: false,
    }),
  ],
  server: {
    port: 3000,
    // Dev only. In Docker, nginx serves the same /api paths.
    proxy: {
      '/api/people': { target: 'http://localhost:4001', pathRewrite: { '^/api/people': '' } },
      '/api/delivery': { target: 'http://localhost:4002', pathRewrite: { '^/api/delivery': '' } },
    },
    historyApiFallback: true,
  },
  html: { title: 'Baseline' },
});
