import depcheck from "depcheck";
import execa from "execa";
import path from "path";
import url from "url";
import { inspect } from "util";

const globalIgnores = [
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "autoprefixer",
  "eslint-config-prettier",
  "eslint-plugin-react",
  "eslint-plugin-react-hooks",
  "postcss",
  "tailwindcss",
  "tsc && unbuild",
];

// TODO: Go through these deps and eliminate the ones that are not needed.
const localIgnores: Record<string, string[]> = {
  "/": ["pnpm", "prettier", "turbo"],
  "/frameworks/react": ["@types/prop-types"],
  "/frameworks/react/preview": ["@types/prop-types", "react", "react-dom"],
  "/frameworks/vue2": ["vue"],
  "/frameworks/vue3/preview": [
    "@vue/shared",
    "@vue/reactivity",
    "@vue/runtime-core",
    "@vue/runtime-dom",
  ],
  "/integrations/vscode": ["ovsx", "vscode"],
};

async function main() {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  const rootDir = path.join(__dirname, "..");
  const json = execa.commandSync("pnpm -r la --json").stdout;
  const workspaces = JSON.parse(json);

  let foundErrors = false;
  for (const workspace of workspaces) {
    const { path: workspacePath } = workspace;
    const relativePath = "/" + path.relative(rootDir, workspacePath);
    if (
      relativePath.includes("/tests/apps/") ||
      relativePath === "/dev-workspace"
    ) {
      continue;
    }
    const results = await depcheck(workspacePath, {
      ignoreDirs: ["node_modules", "client/dist", "dist"],
      ignoreMatches: [...globalIgnores, ...(localIgnores[relativePath] || [])],
    });
    if (results.dependencies.length > 0) {
      console.error(
        `Unwanted runtime dependencies from ${relativePath}: ${inspect(
          results.dependencies
        )}\n`
      );
      foundErrors = true;
    }
    if (results.devDependencies.length > 0) {
      console.error(
        `Unwanted dev dependencies from ${relativePath}: ${inspect(
          results.devDependencies
        )}\n`
      );
      foundErrors = true;
    }
    if (Object.keys(results.missing).length > 0) {
      console.error(
        `Missing packages from ${relativePath}: ${inspect(results.missing)}\n`
      );
      foundErrors = true;
    }
  }

  if (!foundErrors) {
    console.log("Success! No unwanted dependencies found.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
