export function overrideCopyCutPaste() {
  if (!navigator.userAgent.includes(" Code/")) {
    // We're not running in VS Code.
    return;
  }

  document.addEventListener("keydown", (e) => {
    const hasMeta = e.ctrlKey || e.metaKey;
    if (!hasMeta) {
      return;
    }
    switch (e.key.toLowerCase()) {
      case "c":
        document.execCommand("copy");
        e.preventDefault();
        break;
      case "x":
        document.execCommand("cut");
        e.preventDefault();
        break;
      case "v":
        document.execCommand("paste");
        e.preventDefault();
        break;
      case "a":
        document.execCommand("selectAll");
        e.preventDefault();
        break;
    }
  });
}
