set -e

# Update all dependencies to latest except frameworks (and test apps).
# Exclude problematic packages for now.
pnpm --filter "!./dev-workspace" --filter "!./frameworks/**/*" -r update !env-paths !get-port !globby !execa !inquirer !@types/inquirer !@types/vscode !vite-tsconfig-paths "!@previewjs/*" --latest

# Update all other dependencies within their range.
pnpm --filter "!./dev-workspace" -r update !@types/vscode "!@previewjs/*"

# Revert changes from "major.minor" to "major.minor".
LC_ALL=C && LANG=C && find . -type f | grep -v node_modules | grep -v .run | xargs sed -i '' 's/"/"/g'

# Ensure all packages are installed correctly.
pnpm i
