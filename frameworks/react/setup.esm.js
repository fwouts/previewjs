export const setupPreviews = process.env.RUNNING_INSIDE_PREVIEWJS
  ? (Component, previewProps) => {
      if (typeof previewProps === "function") {
        previewProps = previewProps();
      }
      Component.__previewjs_variants = [];
      for (const [key, props] of Object.entries(previewProps)) {
        Component.__previewjs_variants.push({
          key,
          label: key,
          props,
        });
      }
    }
  : () => {
      // You read this right, it's a no-op.
    };
