import { execFile } from "node:child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export function runProcess(command: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      if (error) {
        reject(
          Object.assign(error, {
            stdout,
            stderr
          })
        );
        return;
      }

      resolve({
        stdout,
        stderr
      });
    });
  });
}
