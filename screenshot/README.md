# Generate screenshots with `@previewjs/screenshot`

This library leverages the power of Preview.js foundations in conjunction with [Playwright](https://playwright.dev) to generate screenshots of any components and stories that [Preview.js](https://previewjs.com) can render.

## Example with React

```js
// generate-screenshots.js

import reactPlugin from "@previewjs/plugin-react";
import { generateScreenshots } from "@previewjs/screenshot";
import playwright from "playwright";

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await generateScreenshots({
  page,
  frameworkPlugins: [reactPlugin],
  filePathPattern: "**/*.stories.{js,jsx,ts,tsx}",
  generateScreenshotPath({ filePath, name }) {
    return `${filePath}-${name}.png`;
  },
  onScreenshot({ filePath, name }) {
    console.log(`${filePath} 📸 ${name}`);
  },
});
await browser.close();
```

See [test-app/generate-screenshots.js](https://github.com/fwouts/previewjs/blob/main/screenshot/test-app/generate-screenshots.js) for a simple example.

See the [Hungry example app](https://github.com/fwouts/hungry/blob/main/generate-screenshots.mjs) for a more elaborate example along with a [GitHub Actions workflow](https://github.com/fwouts/hungry/blob/main/.github/workflows/screenshot.yml) that updates screenshots automatically in PRs.

## Setup

Install `playwright`, `@previewjs/screenshot` and the appropriate framework plugin as dev dependencies:

```sh
# NPM
$ npm install -D playwright @previewjs/screenshot @previewjs/plugin-[your-framework]

# PNPM
$ pnpm add -D playwright @previewjs/screenshot @previewjs/plugin-[your-framework]

# Yarn
$ yarn add -D playwright @previewjs/screenshot @previewjs/plugin-[your-framework]
```

Here are the available framework plugins at the time of writing:

- `@previewjs/preact`
- `@previewjs/react`
- `@previewjs/solid`
- `@previewjs/svelte` (see [#1258](https://github.com/fwouts/previewjs/issues/1258) for Storybook support)
- `@previewjs/vue2`
- `@previewjs/vue3`

Then write a Node.js script (like the example above) to generate your screenshots.

## Configuration

Given the brevity of the implementation (~60 LOC), you are encouraged to [read the source](https://github.com/fwouts/previewjs/blob/main/screenshot/src/index.ts) to understand the options that are available to you.

PRs welcome!

## License

This package is distributed under the AGPL-3.0 license, which is a [strong copyleft license](https://snyk.io/learn/agpl-license/).

Make sure that `@previewjs/screenshot` is in your `devDependencies` and that you do not redistribute it in your own packages and applications, unless you comply with the license requirements or obtain a separate commercial license.
