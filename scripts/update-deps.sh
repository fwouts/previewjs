set -e

# Update all dependencies to latest except framework-plugins (and test apps).
# Exclude problematic packages for now.
pnpm --filter "!./dev-workspace" --filter "!./framework-plugins/**/*" -r update !@types/vscode "!@previewjs/*" --latest

# Update all other dependencies within their range.
pnpm --filter "!./dev-workspace" -r update !@types/vscode "!@previewjs/*"

# Revert changes from "major.minor" to "major.minor".
LC_ALL=C && LANG=C && find . -type f | grep -v node_modules | grep -v .run | xargs sed -i '' 's/"/"/g'

# Ensure all packages are installed correctly.
pnpm i
