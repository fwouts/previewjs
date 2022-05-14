import { localEndpoints } from "@previewjs/api";
import { Component } from "./plugins/framework";

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
    args: [...result.providedArgs],
  };
}
