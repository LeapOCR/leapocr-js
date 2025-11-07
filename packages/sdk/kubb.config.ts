import { defineConfig } from '@kubb/core';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginTs } from '@kubb/plugin-ts';

export default defineConfig({
  root: '.',
  input: {
    path: './openapi-filtered.json',
  },
  output: {
    path: './src/generated',
    clean: true,
  },
  plugins: [
    pluginOas({
      output: false,
    }),
    pluginTs({
      output: {
        path: 'models',
      },
      enumType: 'asConst',
      dateType: 'date',
      optionalType: 'questionToken',
    }),
  ],
});
