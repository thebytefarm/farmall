import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname } from "node:path";
import { z } from "zod";

import { syncDirectory } from "./atomic-file.ts";
import { resolveContainedPath } from "../filesystem/contained-path.ts";
import { hasErrno } from "../filesystem/errno.ts";
import { readOptionalText } from "../filesystem/text-file.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { ApplyWarning } from "./types.ts";
import type { CoreError } from "../diagnostics/types.ts";
import type { Plan } from "../planning/types.ts";

const malformedLockRecoveryAgeMs = 5 * 60 * 1_000;

const applyLockMetadataSchema = z
  .object({
    version: z.literal(1),
    pid: z.number().int().positive(),
    hostname: z.string().min(1),
    acquiredAt: z.iso.datetime(),
    processStartedAt: z.iso.datetime(),
    processIdentity: z.string().min(1),
    nonce: z.string().min(1),
  })
  .strict();

export type ApplyLockMetadata = z.infer<typeof applyLockMetadataSchema>;

export interface ApplyLock {
  readonly warnings: readonly ApplyWarning[];
  readonly release: () => Promise<readonly ApplyWarning[]>;
}

type ReadProcessFile = (path: string, encoding: "utf8") => Promise<string>;
type ExecuteProcess = (command: string, arguments_: readonly string[]) => Promise<string>;

const readProcessFile: ReadProcessFile = async (path, encoding) => readFile(path, encoding);

const execute = async (command: string, arguments_: readonly string[]): Promise<string> =>
  new Promise((resolveExecution) => {
    execFile(command, arguments_, { encoding: "utf8" }, (_error, stdout) => {
      resolveExecution(stdout.trim());
    });
  });

const linuxProcessIdentity = async (
  pid: number,
  readIdentityFile: ReadProcessFile,
): Promise<string | null> => {
  try {
    const value = await readIdentityFile(`/proc/${pid}/stat`, "utf8");
    const commandEnd = value.lastIndexOf(")");
    if (commandEnd === -1) return null;
    const fields = value.slice(commandEnd + 2).split(" ");
    const startedAt = fields[19];
    if (startedAt === undefined) return null;
    return `linux:${startedAt}`;
  } catch {
    return null;
  }
};

export const processIdentityFor = async (
  pid: number,
  platform: NodeJS.Platform = process.platform,
  readIdentityFile: ReadProcessFile = readProcessFile,
  executeIdentityProcess: ExecuteProcess = execute,
): Promise<string | null> => {
  if (platform === "linux") return linuxProcessIdentity(pid, readIdentityFile);
  if (platform === "darwin") {
    const startedAt = await executeIdentityProcess("ps", ["-o", "lstart=", "-p", String(pid)]);
    if (startedAt.length === 0) return null;
    return `darwin:${startedAt}`;
  }
  return null;
};

const lockMetadata = async (): Promise<ApplyLockMetadata> => {
  const startedAt = Date.now() - process.uptime() * 1_000;
  const identity = await processIdentityFor(process.pid);
  const processIdentity = processIdentityOrFallback(identity, process.platform, process.execPath);
  return {
    version: 1,
    pid: process.pid,
    hostname: hostname(),
    acquiredAt: new Date().toISOString(),
    processStartedAt: new Date(startedAt).toISOString(),
    processIdentity,
    nonce: randomUUID(),
  };
};

export const processIdentityOrFallback = (
  identity: string | null,
  platform: NodeJS.Platform,
  executable: string,
): string => {
  if (identity !== null) return identity;
  return `${platform}:unavailable:${executable}`;
};

const parseMetadata = (content: string): ApplyLockMetadata | null => {
  try {
    const parsed = applyLockMetadataSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const readMetadata = async (
  root: string,
  lockPath: string,
): Promise<Result<ApplyLockMetadata | null, CoreError>> => {
  const content = await readOptionalText(root, lockPath, "apply");
  if (!content.ok) return content;
  if (content.value === null) return ok(null);
  return ok(parseMetadata(content.value));
};

type SignalProcess = (pid: number) => void;

const signalProcess: SignalProcess = (pid) => process.kill(pid, 0);

export const isLockOwnerProvablyDead = async (
  metadata: ApplyLockMetadata,
  identityFor: (pid: number) => Promise<string | null> = processIdentityFor,
  signalOwner: SignalProcess = signalProcess,
  localHostname: string = hostname(),
  platform: NodeJS.Platform = process.platform,
): Promise<boolean> => {
  if (metadata.hostname !== localHostname) return false;
  try {
    signalOwner(metadata.pid);
  } catch (error) {
    return hasErrno(error, "ESRCH");
  }
  const identity = await identityFor(metadata.pid);
  if (identity === null) return false;
  if (!metadata.processIdentity.startsWith(`${platform}:`)) return false;
  return identity !== metadata.processIdentity;
};

const publishExclusive = async (
  absolute: string,
  content: string,
  path: string,
): Promise<Result<void, CoreError>> => {
  const temporary = `${absolute}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(absolute), { recursive: true });
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    await Promise.allSettled([rm(temporary, { force: true })]);
    return err({ code: "apply", message: errorMessage(error), path });
  }
  try {
    await link(temporary, absolute);
  } catch (error) {
    await Promise.allSettled([rm(temporary, { force: true })]);
    return err({ code: "apply", message: errorMessage(error), path });
  }
  await Promise.allSettled([rm(temporary, { force: true })]);
  try {
    await syncDirectory(dirname(absolute));
    return ok(undefined);
  } catch (error) {
    await Promise.allSettled([rm(absolute, { force: true })]);
    return err({ code: "apply", message: errorMessage(error), path });
  }
};

const cleanupWarning = (path: string, error: unknown): ApplyWarning => ({
  code: "lock-cleanup",
  message: errorMessage(error),
  path,
});

const releaseOwnedPath = async (
  root: string,
  path: string,
  metadata: ApplyLockMetadata,
): Promise<Result<void, ApplyWarning>> => {
  const safe = await resolveContainedPath(root, path, "apply");
  if (!safe.ok) return err(cleanupWarning(path, new Error(safe.error.message)));
  const current = await readMetadata(root, path);
  if (!current.ok) return err(cleanupWarning(path, new Error(current.error.message)));
  if (
    current.value === null ||
    current.value.nonce !== metadata.nonce ||
    current.value.processIdentity !== metadata.processIdentity
  ) {
    return err(cleanupWarning(path, new Error("Apply lock ownership changed before release")));
  }
  try {
    await rm(safe.value);
    await syncDirectory(dirname(safe.value));
    return ok(undefined);
  } catch (error) {
    return err(cleanupWarning(path, error));
  }
};

const createLock = async (
  plan: Plan,
  absolute: string,
  lockPath: string,
  warnings: readonly ApplyWarning[],
): Promise<Result<ApplyLock, CoreError>> => {
  const metadata = await lockMetadata();
  const published = await publishExclusive(
    absolute,
    `${JSON.stringify(metadata, null, 2)}\n`,
    lockPath,
  );
  if (!published.ok) return published;
  return ok({
    warnings,
    release: async () => {
      const released = await releaseOwnedPath(plan.root, lockPath, metadata);
      if (released.ok) return [];
      return [released.error];
    },
  });
};

const isMalformedLockAbandoned = async (absolute: string): Promise<boolean> => {
  try {
    const metadata = await stat(absolute);
    return Date.now() - metadata.mtimeMs >= malformedLockRecoveryAgeMs;
  } catch {
    return false;
  }
};

const recoveryWarning = (metadata: ApplyLockMetadata | null): ApplyWarning => {
  if (metadata === null) {
    return {
      code: "stale-lock-recovered",
      message: "Recovered malformed abandoned apply lock",
      path: "",
    };
  }
  return {
    code: "stale-lock-recovered",
    message: `Recovered apply lock owned by dead process ${metadata.pid}`,
    path: "",
  };
};

const clearAbandonedRecoveryGate = async (
  plan: Plan,
  absolute: string,
  path: string,
): Promise<Result<ApplyWarning, CoreError>> => {
  const current = await readMetadata(plan.root, path);
  if (!current.ok) return current;
  if (current.value === null) {
    const abandoned = await isMalformedLockAbandoned(absolute);
    if (!abandoned) {
      return err({ code: "apply", message: "Another Farmall apply is already running", path });
    }
    try {
      await rm(absolute);
      await syncDirectory(dirname(absolute));
      return ok({ ...recoveryWarning(null), path });
    } catch (error) {
      return err({ code: "apply", message: errorMessage(error), path });
    }
  }
  if (!(await isLockOwnerProvablyDead(current.value))) {
    return err({ code: "apply", message: "Another Farmall apply is already running", path });
  }
  const released = await releaseOwnedPath(plan.root, path, current.value);
  if (!released.ok) return err({ code: "apply", message: released.error.message, path });
  return ok({ ...recoveryWarning(current.value), path });
};

const recoverStaleLock = async (
  plan: Plan,
  absolute: string,
  lockPath: string,
): Promise<Result<ApplyWarning, CoreError>> => {
  const current = await readMetadata(plan.root, lockPath);
  if (!current.ok) return current;
  if (current.value === null) {
    const abandoned = await isMalformedLockAbandoned(absolute);
    if (!abandoned) {
      return err({
        code: "apply",
        message: "Another Farmall apply is already running",
        path: lockPath,
      });
    }
  }
  if (current.value !== null && !(await isLockOwnerProvablyDead(current.value))) {
    return err({
      code: "apply",
      message: "Another Farmall apply is already running",
      path: lockPath,
    });
  }
  try {
    await rm(absolute);
    await syncDirectory(dirname(absolute));
    return ok({ ...recoveryWarning(current.value), path: lockPath });
  } catch (error) {
    return err({ code: "apply", message: errorMessage(error), path: lockPath });
  }
};

const recoverLock = async (
  plan: Plan,
  absolute: string,
  lockPath: string,
  reaperAbsolute: string,
  reaperPath: string,
): Promise<Result<ApplyWarning, CoreError>> => {
  const reaperMetadata = await lockMetadata();
  const gated = await publishExclusive(
    reaperAbsolute,
    `${JSON.stringify(reaperMetadata, null, 2)}\n`,
    reaperPath,
  );
  if (!gated.ok) {
    return err({
      code: "apply",
      message: "Another Farmall apply is already running",
      path: lockPath,
    });
  }
  const result = await recoverStaleLock(plan, absolute, lockPath);
  const released = await releaseOwnedPath(plan.root, reaperPath, reaperMetadata);
  if (!released.ok)
    return err({ code: "apply", message: released.error.message, path: reaperPath });
  return result;
};

const acquireWithoutRecoveryGate = async (
  plan: Plan,
  absolute: string,
  lockPath: string,
  reaperAbsolute: string,
  reaperPath: string,
  warnings: readonly ApplyWarning[],
): Promise<Result<ApplyLock, CoreError>> => {
  const created = await createLock(plan, absolute, lockPath, warnings);
  if (created.ok) return created;
  if (!created.error.message.includes("EEXIST")) return created;
  const recovered = await recoverLock(plan, absolute, lockPath, reaperAbsolute, reaperPath);
  if (!recovered.ok) return recovered;
  return createLock(plan, absolute, lockPath, [...warnings, recovered.value]);
};

export const acquireApplyLock = async (plan: Plan): Promise<Result<ApplyLock, CoreError>> => {
  const lockPath = `${plan.statePath}.lock`;
  const reaperPath = `${lockPath}.reap`;
  const safeLock = await resolveContainedPath(plan.root, lockPath, "apply");
  if (!safeLock.ok) return safeLock;
  const safeReaper = await resolveContainedPath(plan.root, reaperPath, "apply");
  if (!safeReaper.ok) return safeReaper;
  const reaper = await readOptionalText(plan.root, reaperPath, "apply");
  if (!reaper.ok) return reaper;
  if (reaper.value !== null) {
    const cleared = await clearAbandonedRecoveryGate(plan, safeReaper.value, reaperPath);
    if (!cleared.ok) return cleared;
    return acquireWithoutRecoveryGate(
      plan,
      safeLock.value,
      lockPath,
      safeReaper.value,
      reaperPath,
      [cleared.value],
    );
  }
  return acquireWithoutRecoveryGate(
    plan,
    safeLock.value,
    lockPath,
    safeReaper.value,
    reaperPath,
    [],
  );
};
