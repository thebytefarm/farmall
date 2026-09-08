const immutableValue = (value: unknown, ancestors: readonly unknown[]): unknown => {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Array.isArray(value)) {
    if (ancestors.includes(value)) throw new TypeError("Cannot clone cyclic plugin values");
    const cloned = value.map((item) => immutableValue(item, [...ancestors, value]));
    return Object.freeze(cloned);
  }
  if (value !== null && typeof value === "object") {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Cannot clone unsupported plugin values");
    }
    if (ancestors.includes(value)) throw new TypeError("Cannot clone cyclic plugin values");
    const cloned = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        immutableValue(item, [...ancestors, value]),
      ]),
    );
    return Object.freeze(cloned);
  }
  if (typeof value === "function") throw new TypeError("Cannot clone unsupported plugin values");
  return value;
};

export const immutableClone = <T>(value: T): T => immutableValue(value, []) as T;
