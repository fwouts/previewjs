#!/bin/sh

set -e

mkdir -p dist/monaco-editor/min/vs/editor
mkdir -p dist/monaco-editor/min/vs/basic-languages/typescript
mkdir -p dist/monaco-editor/min/vs/language
mkdir -p dist/monaco-editor/min/vs/language/typescript

pnpm shx cp node_modules/monaco-editor/LICENSE dist/monaco-editor/LICENSE
pnpm shx cp -r node_modules/monaco-editor/min/vs/base dist/monaco-editor/min/vs/base
pnpm shx cp node_modules/monaco-editor/min/vs/basic-languages/typescript/typescript.js dist/monaco-editor/min/vs/basic-languages/typescript/typescript.js
pnpm shx cp node_modules/monaco-editor/min/vs/editor/editor.main.js dist/monaco-editor/min/vs/editor/editor.main.js
pnpm shx cp node_modules/monaco-editor/min/vs/editor/editor.main.css dist/monaco-editor/min/vs/editor/editor.main.css
pnpm shx cp node_modules/monaco-editor/min/vs/editor/editor.main.nls.js dist/monaco-editor/min/vs/editor/editor.main.nls.js
pnpm shx cp node_modules/monaco-editor/min/vs/language/typescript/tsMode.js dist/monaco-editor/min/vs/language/typescript/tsMode.js
pnpm shx cp node_modules/monaco-editor/min/vs/language/typescript/tsWorker.js dist/monaco-editor/min/vs/language/typescript/tsWorker.js
pnpm shx cp node_modules/monaco-editor/min/vs/loader.js dist/monaco-editor/min/vs/loader.js
