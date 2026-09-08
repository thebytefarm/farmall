export const errnoCode = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) return undefined;
  if (!("code" in error)) return undefined;
  if (typeof error.code !== "string") return undefined;
  return error.code;
};

export const hasErrno = (error: unknown, ...codes: readonly string[]): boolean => {
  const code = errnoCode(error);
  if (code === undefined) return false;
  return codes.includes(code);
};
