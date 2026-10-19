type TimeoutHandler = (pedidoId: string, wave: number) => Promise<void>;

export class WaveScheduler {
  private handler: TimeoutHandler | null = null;
  private timers = new Map<string, NodeJS.Timeout>();

  bind(handler: TimeoutHandler): void {
    this.handler = handler;
  }

  async schedule(pedidoId: string, wave: number, delayMs: number): Promise<void> {
    const jobId = `${pedidoId}:${wave}`;
    const previous = this.timers.get(jobId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.timers.delete(jobId);
      void this.handler?.(pedidoId, wave);
    }, delayMs);
    this.timers.set(jobId, timer);
  }
}
