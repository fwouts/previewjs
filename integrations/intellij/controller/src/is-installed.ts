import { isInstalled } from "@previewjs/loader";
import path from "path";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const installed = await isInstalled({
    installDir: path.join(__dirname, "installed"),
  });
  process.stdout.write(installed ? "installed" : "missing");
}
