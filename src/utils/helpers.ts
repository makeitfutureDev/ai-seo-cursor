// Helper function to add timeout to promises
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> => {
  // Avoid timer-based races when the tab is backgrounded (timers are throttled)
  if (typeof document !== 'undefined' && document.hidden) {
    return promise;
  }
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
};