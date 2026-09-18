// Security Spec §3.1: Rate Limiting
const CONCURRENCY_LIMIT = 2; // Conservative cap
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 1500;

export async function delayWithJitter() {
  const delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

class Semaphore {
  private count: number;
  private queue: (() => void)[] = [];

  constructor(count: number) {
    this.count = count;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release() {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      if (resolve) resolve();
    } else {
      this.count++;
    }
  }
}

export const scrapeSemaphore = new Semaphore(CONCURRENCY_LIMIT);
