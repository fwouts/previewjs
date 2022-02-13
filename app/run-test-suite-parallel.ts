import execa from "execa";
import playwright from "playwright";

async function main() {
  const headless = process.env["HEADLESS"] !== "0";
  const browser = await playwright.chromium.launchServer({
    headless,
    devtools: !headless,
  });
  const groupCount = parseInt(process.env["GROUP_COUNT"] || "1");
  const processes: execa.ExecaChildProcess[] = [];
  for (let i = 0; i < groupCount; i++) {
    processes.push(
      execa.command("pnpm e2e-test:group", {
        env: {
          ...process.env,
          CHROMIUM_WS_ENDPOINT: browser.wsEndpoint(),
          GROUP_INDEX: i.toString(10),
          GROUP_COUNT: groupCount.toString(10),
        },
        stdout: "inherit",
        stderr: "inherit",
      })
    );
  }
  let failed = false;
  try {
    const results = await Promise.all(processes);
    const anyFailed = results.reduce((acc, curr) => {
      return acc || curr.failed;
    }, false);
    failed = anyFailed;
  } finally {
    await browser.close();
  }
  if (failed) {
    process.exit(1);
  }
}

main().catch();
