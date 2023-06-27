import net from "net";

export async function getFreePort(min: number) {
  for (let port = min; ; port++) {
    if (await isAvailable(port)) {
      return port;
    }
  }
}

async function isAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}
