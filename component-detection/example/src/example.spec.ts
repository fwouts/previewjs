import { createComponentDetector } from "@previewjs/component-detection-react";
import { describe, expect, test } from "vitest";

describe("example", () => {
  test("foo", async () => {
    const detector = createComponentDetector({
      rootDir: __dirname,
    });
    expect(await detector.detectComponents(["components.tsx"]))
      .toMatchInlineSnapshot(`
      [
        {
          "componentId": "components.tsx:A",
          "exported": true,
          "extractProps": [Function],
          "kind": "component",
          "offsets": [
            0,
            29,
          ],
        },
        {
          "componentId": "components.tsx:B",
          "exported": false,
          "extractProps": [Function],
          "kind": "component",
          "offsets": [
            31,
            72,
          ],
        },
      ]
    `);
    detector.dispose();
  });
});
