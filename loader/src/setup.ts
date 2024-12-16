import fs from "fs-extra";
import path from "path";
import url from "url";

export async function copyLoader(destPath: string, type: "cjs" | "esm") {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  await fs.copy(
    path.join(__dirname, "../node_modules/pnpm"),
    path.join(destPath, "pnpm"),
    {
      dereference: true,
    }
  );
  const {
    default: { dependencies },
  } = await import(
    url
      .pathToFileURL(path.join(__dirname, "../src/release/package.json"))
      .toString(),
    {
      with: {
        type: "json",
      },
    }
  );
  await fs.writeFile(
    path.join(destPath, "package.json"),
    JSON.stringify(
      {
        type: type === "cjs" ? "commonjs" : "module",
        dependencies,
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.copy(
    path.join(__dirname, "../src/release/pnpm-lock.yaml"),
    path.join(destPath, "pnpm-lock.yaml")
  );
  await fs.copy(
    path.join(__dirname, "../src/release/pnpm-workspace.yaml"),
    path.join(destPath, "pnpm-workspace.yaml")
  );
}
