import { defineConfig } from "orval";

export default defineConfig({
  "openapi-file": {
    input: "http://localhost:8080/api/v1/docs/openapi.json",
    output: {
      mode: "tags-split",
      target: "./src/generated/models.ts",
      schemas: "./src/generated/models",
      client: "axios",
      clean: true,
      override: {
        mutator: {
          path: './src/lib/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
