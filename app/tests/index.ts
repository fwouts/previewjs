import reactTests from "./react";
import { smokeTests } from "./smoke-tests.spec";
import solidTests from "./solid";
import vue2Tests from "./vue2";
import vue3Tests from "./vue3";

export default [
  ...smokeTests,
  ...reactTests,
  ...solidTests,
  ...vue2Tests,
  ...vue3Tests,
];
