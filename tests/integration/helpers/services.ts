/**
 * Service orchestrator for integration tests.
 *
 * Starts all AIVO services as child processes on sequential ports, pointing
 * them at the test database. Services are shut down in teardown.
 */
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDbUrl } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICES_DIR = path.resolve(__dirname, "../../../services");

/** Port assignments for integration tests (non-overlapping with dev ports). */
export const SERVICE_PORTS: Record<string, number> = {
  "identity-svc": 14001,
  "assessment-svc": 14002,
  "brain-svc": 14003,
  "family-svc": 14007,
  "tutor-svc": 14004,
  "learning-svc": 14005,
  "admin-svc": 14006,
  "comms-svc": 14008,
  "billing-svc": 14009,
};

export function serviceUrl(name: string, path_ = ""): string {
  const port = SERVICE_PORTS[name];
  if (!port) throw new Error(`Unknown service: ${name}`);
  return `http://localhost:${port}${path_}`;
}

const _processes = new Map<string, ChildProcess>();

export async function startAllServices(): Promise<void> {
  const dbUrl = getDbUrl();
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    NODE_ENV: "test",
    LOG_LEVEL: "warn",
    JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY ?? "",
    JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY ?? "",
  };

  const starts: Promise<void>[] = [];
  for (const [name, port] of Object.entries(SERVICE_PORTS)) {
    const serviceDir = path.join(SERVICES_DIR, name);
    const portEnvKey = `${name.replace(/-/g, "_").toUpperCase()}_PORT`;

    starts.push(
      new Promise((resolve) => {
        const proc = spawn("node", ["--loader", "ts-node/esm", "src/index.ts"], {
          cwd: serviceDir,
          env: { ...env, [portEnvKey]: String(port) },
          stdio: ["ignore", "pipe", "pipe"],
        });
        _processes.set(name, proc);
        // Resolve once the service signals it is ready (listens on port).
        const ready = setTimeout(resolve, 8000); // give 8s max per service
        proc.stdout?.on("data", (chunk: Buffer) => {
          if (chunk.toString().includes("listening") || chunk.toString().includes("started")) {
            clearTimeout(ready);
            resolve();
          }
        });
        proc.on("error", () => {
          clearTimeout(ready);
          resolve();
        });
      }),
    );
  }

  await Promise.all(starts);
}

export async function stopAllServices(): Promise<void> {
  for (const [, proc] of _processes) {
    proc.kill("SIGTERM");
  }
  _processes.clear();
  // Allow brief time for graceful shutdown.
  await new Promise((r) => setTimeout(r, 1000));
}
