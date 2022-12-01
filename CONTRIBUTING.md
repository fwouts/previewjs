# Preview.js Contributing Guide

Hello! Thank you for considering contributing to Preview.js :)

This contributing guide is quite rudimentary at the moment, feel free to suggest improvements.

Before you start, please review the [Contributor Assignment Agreement](./CAA.md). You will need to sign it before your PR can be merged.

## Repo Setup

This is a monorepo managed by [pnpm]([url](https://pnpm.io)) using [Turborepo](https://turbo.build) to manage builds:
- Ensure you have `pnpm` installed.
- Run `pnpm i` from the root.
- Build all packages by running `pnpm turbo build`.

## Working with the VS Code extension

Go to `integrations/vscode` and run `pnpm dev`.

Note that the OSS implementation of Preview.js is a simpler webview than the official packaged extension.

Note: You may need to run `killall node` and reload the VS Code window (Cmd/Ctrl+P then `Developer: Reload Window`) if Preview.js is already running.
