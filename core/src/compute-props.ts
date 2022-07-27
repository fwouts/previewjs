import type { localEndpoints } from "@previewjs/api";
import type { Component } from "./plugins/framework";

export async function computeProps({
  component,
}: {
  component: Component;
}): Promise<localEndpoints.ComputePropsResponse> {
  const result = await component.analyze();
  return {
    types: {
      props: result.propsType,
      all: result.types,
    },
    isStory: component.isStory,
    args: [...result.providedArgs],
  };
}
