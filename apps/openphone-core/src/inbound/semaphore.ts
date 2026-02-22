type Resolver = () => void;

export function createSemaphore(limit: number): {
  acquire: () => Promise<void>;
  release: () => void;
} {
  let available = Math.max(1, limit);
  const waitQueue: Resolver[] = [];

  const acquire = (): Promise<void> => {
    if (available > 0) {
      available--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  };

  const release = (): void => {
    const next = waitQueue.shift();
    if (next) {
      next();
    } else {
      available++;
    }
  };

  return { acquire, release };
}
