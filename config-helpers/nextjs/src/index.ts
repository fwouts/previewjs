import * as NextImage from "next/image";
import * as NextRouter from "next/router";
import React from "react";

const OriginalNextImage = NextImage.default;

// Patch Image to disable optimisations within Preview.js.
Object.defineProperty(NextImage, "default", {
  configurable: true,
  value: (props: NextImage.ImageProps) =>
    React.createElement(OriginalNextImage, {
      ...props,
      unoptimized: true,
    }),
});

// Patch useRouter() to fake the router within Preview.js.
Object.defineProperty(NextRouter, "useRouter", {
  configurable: true,
  value: () => ({
    locale: "en-US",
    route: "/",
    pathname: "/",
    query: {},
    asPath: "/",
    push() {
      return Promise.resolve(true);
    },
    replace() {
      return Promise.resolve(true);
    },
    reload() {
      // Do nothing.
    },
    back() {
      // Do nothing.
    },
    prefetch() {
      return Promise.resolve();
    },
    beforePopState() {
      // Do nothing.
    },
    events: {
      on() {
        // Do nothing.
      },
      off() {
        // Do nothing.
      },
      emit() {
        // Do nothing.
      },
    },
    isFallback: false,
  }),
});
