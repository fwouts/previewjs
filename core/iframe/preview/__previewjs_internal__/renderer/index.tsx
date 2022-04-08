import { RendererLoader } from "../../..";

export const load: RendererLoader = async () => {
  // This is a dummy function that is replaced by
  // a framework-specific implementation at runtime.
  console.error("Dummy loader was invoked!");
  return {
    variants: [],
    render: async () => {},
  };
};

export async function detach() {}
{
}
