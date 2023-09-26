export function generateMessageFromError(errorMessage: string, stack?: string) {
  let message = errorMessage + (stack ? `\n${stack}` : "");
  // Remove any redundant line breaks (but not spaces,
  // which could be useful indentation).
  message = message.replace(/^\n+/g, "\n").trim();
  const stripPrefix = "Internal server error: ";
  if (message.startsWith(stripPrefix)) {
    message = message.substr(stripPrefix.length);
  }
  if (/^Transform failed with \d+ errors?:?\n.*/.test(message)) {
    const lineBreakPosition = message.indexOf("\n");
    message = message.substring(lineBreakPosition + 1);
  }
  const lineBreakPosition = message.indexOf("\n");
  let title: string;
  let rest: string;
  if (lineBreakPosition > -1) {
    title = message.substr(0, lineBreakPosition).trim();
    rest = message.substr(lineBreakPosition + 1);
  } else {
    title = message;
    rest = "";
  }
  if (title.endsWith(":") || title.endsWith(".")) {
    title = title.substr(0, title.length - 1).trim();
  }
  // Note: this isn't relevant to all browsers.
  if (rest.startsWith(`Error: ${title}\n`)) {
    rest = rest.substr(rest.indexOf("\n") + 1);
  }
  return `${title}${rest ? `\n\n${rest}` : ""}`;
}
