const pending = new Map<string, Promise<unknown>>();

/**
 * Run a task serialized per key. Only one task runs per key at a time;
 * subsequent calls for the same key wait for the prior to finish.
 */
export async function runSerializedForKey<T>(
  key: string,
  run: () => Promise<T>
): Promise<T> {
  const prior = pending.get(key) ?? Promise.resolve();
  const chain = prior
    .then(() => run())
    .finally(() => {
      if (pending.get(key) === chain) {
        pending.delete(key);
      }
    });
  pending.set(key, chain);
  return chain as Promise<T>;
}
