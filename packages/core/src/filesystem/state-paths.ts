export const reservedStatePaths = (statePath: string): readonly string[] => [
  statePath,
  `${statePath}.lock`,
  `${statePath}.lock.reap`,
  `${statePath}.journal`,
];

export const isReservedStatePath = (statePath: string, path: string): boolean =>
  reservedStatePaths(statePath).includes(path);
