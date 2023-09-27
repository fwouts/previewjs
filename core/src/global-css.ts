export const GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT = [
  "index",
  "global",
  "globals",
  "style",
  "styles",
  "app",
];
export const GLOBAL_CSS_EXTS = [
  "css",
  "sass",
  "scss",
  "less",
  "styl",
  "stylus",
];

export const GLOBAL_CSS_FILE = GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT.flatMap(
  (fileName) => GLOBAL_CSS_EXTS.map((ext) => `${fileName}.${ext}`)
);
