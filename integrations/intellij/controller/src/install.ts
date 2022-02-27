import { install } from "@previewjs/loader";
import path from "path";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  await install({
    installDir: path.join(__dirname, "installed"),
    onOutput: (chunk) => process.stdout.write(chunk),
  });
}
