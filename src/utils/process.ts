import { execFile, spawn } from "node:child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export interface SpawnProcessOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SpawnProcessResult extends ProcessResult {
  exitCode: number;
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

export function runSpawnedProcess(
  command: string,
  args: string[],
  options: SpawnProcessOptions = {}
): Promise<SpawnProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "pipe",
      signal: options.signal
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      reject(
        Object.assign(error, {
          stdout,
          stderr
        })
      );
    });

    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      if (code === 0) {
        resolve({
          stdout,
          stderr,
          exitCode: 0
        });
        return;
      }

      reject(
        Object.assign(
          new Error(timedOut ? `Process timed out after ${options.timeoutMs}ms` : `Process exited with code ${code ?? -1}`),
          {
            stdout,
            stderr,
            exitCode: code ?? -1,
            timedOut
          }
        )
      );
    });

    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin);
    }

    child.stdin.end();
  });
}
