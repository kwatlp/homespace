/** Output sink, injectable so commands are testable without touching stdio. */
export interface IO {
  out(message: string): void;
  err(message: string): void;
}

/** Default IO: write straight to the process streams. */
export const consoleIO: IO = {
  out: (message) => {
    process.stdout.write(message);
  },
  err: (message) => {
    process.stderr.write(message);
  },
};

/** Shared command context. */
export interface Context {
  /** Working directory (the homespace root for most commands). */
  cwd: string;
  io: IO;
}
