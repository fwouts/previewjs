set -e

# Update all dependencies to latest except frameworks (and test apps).
# Exclude problematic packages for now.
pnpm --filter "!./frameworks/**/*" -r update !env-paths !get-port !globby !execa !inquirer !@types/inquirer !@types/vscode !vite-tsconfig-paths --latest

# Update all other dependencies within their range.
pnpm -r update

# Ensure all packages are installed correctly.
pnpm i
