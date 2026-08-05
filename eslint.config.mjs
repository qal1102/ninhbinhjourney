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
    ".next.locked-backup-*/**",
    ".next-build*/**",
    "out/**",
    "build/**",
    "artifacts/**",
    "next-env.d.ts",
    // Tai nguyen skill Claude Code (vd. helper script cua brainstorming) --
    // ma nguon vendor cua ho, khong phai code cua repo nay, khong nen lint.
    ".claude/**",
  ]),
]);

export default eslintConfig;
