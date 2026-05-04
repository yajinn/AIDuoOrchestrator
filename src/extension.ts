import * as vscode from "vscode";
import { registerCommands } from "./commands";

let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("AI Duo");
  outputChannel.appendLine("AI Duo extension activated.");
  context.subscriptions.push(outputChannel);

  registerCommands(context, {
    output: outputChannel
  });
}

export function deactivate(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
