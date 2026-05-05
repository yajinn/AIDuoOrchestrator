export function printAiduoLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function normalizeTerminalText(input: string): string {
  return input.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n");
}
