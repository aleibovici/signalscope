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
    "backtesting/**",
  ]),
  {
    // eslint-plugin-react@7.37.5 (bundled by eslint-config-next) calls the
    // deprecated context.getFilename() API which was removed in ESLint 10.
    // Setting an explicit React version bypasses the auto-detection that
    // triggers the broken API call, making the config compatible with ESLint 10.
    settings: {
      react: {
        version: "19.2.3",
      },
    },
  },
]);

export default eslintConfig;
