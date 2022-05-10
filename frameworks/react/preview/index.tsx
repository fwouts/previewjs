import type { RendererLoader } from "@previewjs/core/controller";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
// @ts-ignore Vite is fine with this
import { version } from "react/package.json";

const moduleName = parseInt(version) >= 18 ? "./render-18" : "./render-16";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    React.Fragment;
  const Component =
    componentModule[
      componentName === "default" ? "default" : `__previewjs__${componentName}`
    ];
  if (!Component) {
    throw new Error(`No component named '${componentName}'`);
  }
  const decorators = [
    ...(Component.decorators || []),
    ...(componentModule.default?.decorators || []),
  ];
  const variants = (Component.__previewjs_variants || []).map((variant) => {
    return {
      key: variant.key,
      label: variant.label,
      props: variant.props,
    };
  });
  const Decorated = (props) =>
    decorators.reduce(
      (component, decorator) => () => decorator(component),
      () => <Component {...Component.args} {...props} />
    )();
  const Box = ({ children }) => (
    <div
      style={{
        flexGrow: "1",
        // overflow: "auto",
        transform: "scale(1, 1)",
      }}
    >
      <h1
        style={{
          fontSize: "1.1rem",
          fontWeight: "normal",
          background: "#334155",
          color: "#FFFFFF",
          padding: "0.5rem",
          margin: "0",
        }}
      >
        Title
      </h1>
      <Wrapper>{children}</Wrapper>
    </div>
  );
  const Renderer = (props) => {
    const count = 4;
    let [scale, setScale] = useState(1);
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
    const gridRef = useRef<HTMLDivElement>();
    useEffect(() => {
      function handleResize() {
        setViewportHeight(window.innerHeight);
      }
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    useLayoutEffect(() => {
      const height = gridRef.current.offsetHeight;
      if (!height) {
        return;
      }
      const computedScale = Math.min(1, viewportHeight / height);
      if (computedScale !== scale) {
        setScale(computedScale);
      }
    }, [viewportHeight]);
    return (
      <div
        style={{
          transformOrigin: "0% 0%",
          transform: `scale(${scale})`,
          height: "100vh",
        }}
      >
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${count}, 1fr)`,
            width: `${100 / scale}vw`,
          }}
        >
          <Box>
            <Decorated {...props} />
          </Box>
          <Box>
            <Decorated {...props} />
          </Box>
          <Box>
            <Decorated {...props} />
          </Box>
          <Box>
            <Decorated {...props} />
          </Box>
        </div>
      </div>
    );
  };
  return {
    variants,
    render: async (props) => {
      const { render } = await import(/* @vite-ignore */ moduleName);
      await render(Renderer, props);
    },
  };
};

export async function detach() {
  const { render } = await import(/* @vite-ignore */ moduleName);
  render(null, {});
}
