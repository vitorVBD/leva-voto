import { randomUUID } from "crypto";

export interface DistributedLock {
  acquire(key: string, ttlSeconds: number): Promise<string | null>;
  release(key: string, token: string): Promise<void>;
}

export class MemoryLock implements DistributedLock {
  private locks = new Map<string, { token: string; expires: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async acquire(key: string, ttlSeconds: number): Promise<string | null> {
    const current = this.locks.get(key);
    const now = this.now();
    if (current && current.expires > now) return null;
    const token = randomUUID();
    this.locks.set(key, { token, expires: now + ttlSeconds * 1000 });
    return token;
  }

  async release(key: string, token: string): Promise<void> {
    const current = this.locks.get(key);
    if (current?.token === token) this.locks.delete(key);
  }
}
