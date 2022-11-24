import reactTests from "./react";
import { smokeTests } from "./smoke-tests.spec";
import svelteTests from "./svelte";
import vue2Tests from "./vue2";
import vue3Tests from "./vue3";

export default [
  ...smokeTests,
  ...reactTests,
  ...svelteTests,
  ...vue2Tests,
  ...vue3Tests,
];
