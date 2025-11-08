import { defineConfig } from "orval";

export default defineConfig({
  "openapi-file": {
    input: "http://localhost:8080/api/v1/docs/openapi.json",
    output: {
      mode: "tags-split",
      target: "./src/generated/models.ts",
      schemas: "./src/generated/models",
      client: "fetch",
    },
  },
});
