import vscode, { Uri } from "vscode";

export async function openUsageOnFirstTimeStart(
  context: vscode.ExtensionContext
) {
  const stateKey = "welcome_screen.shown";
  const showedWelcomeScreenAlready = context.globalState.get<boolean>(stateKey);
  if (showedWelcomeScreenAlready) {
    return;
  }
  await vscode.env.openExternal(Uri.parse("https://previewjs.com/docs"));
  await context.globalState.update(stateKey, true);
}
