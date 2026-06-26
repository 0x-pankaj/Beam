import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // We initialize external SDKs (Magic, Particle UA) and fetch their data
      // from effects, then store handles/results in state — the intended use of
      // effects. This Next 16 rule flags that legitimate pattern as a perf smell.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
