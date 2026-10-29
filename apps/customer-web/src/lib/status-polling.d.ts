export function startStatusPolling(
  checkStatus: () => Promise<boolean>,
  delays: number[],
  options?: {
    initialDelay?: number;
    schedule?: (callback: () => void, delay: number) => unknown;
    cancel?: (timer: unknown) => void;
    onStop?: () => void;
    onExhausted?: () => void;
  },
): () => void;
