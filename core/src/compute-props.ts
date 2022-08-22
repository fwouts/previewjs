import type { localEndpoints } from "@previewjs/api";
import { EMPTY_OBJECT_TYPE } from "@previewjs/type-analyzer";
import type { Component } from "./plugins/framework";

export async function computeProps({
  component,
}: {
  component: Component;
}): Promise<localEndpoints.ComputePropsResponse> {
  if (component.isStory) {
    return {
      types: {
        props: EMPTY_OBJECT_TYPE,
        all: {},
      },
    };
  }
  const result = await component.analyze();
  return {
    types: {
      props: result.propsType,
      all: result.types,
    },
  };
}
