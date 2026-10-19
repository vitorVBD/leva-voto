import { loadConfig } from "./config";
import { DomainEvents } from "./infra/events";
import { MemoryLock } from "./infra/lock";
import { Api } from "./http/api";
import { PurgeScheduler } from "./lgpd/schedule";
import { MatchingEngine } from "./matching/engine";
import { WaveScheduler } from "./matching/wave.scheduler";
import { createStore } from "./store/create-store";

type App = { api: Api };

const globalForApp = globalThis as unknown as { leva?: Promise<App> };

export function getApp(): Promise<App> {
  if (!globalForApp.leva) globalForApp.leva = boot();
  return globalForApp.leva;
}

async function boot(): Promise<App> {
  const config = loadConfig();
  const store = await createStore(config.databaseUrl);
  const events = new DomainEvents();
  const engine = new MatchingEngine(store, new MemoryLock(), events, config);
  const waves = new WaveScheduler();
  waves.bind((pedidoId, wave) => engine.onWaveTimeout(pedidoId, wave));
  engine.setScheduler((pedidoId, wave, delayMs) => {
    void waves.schedule(pedidoId, wave, delayMs);
  });
  new PurgeScheduler(store, config).start();
  const api = new Api(store, config, engine);
  api.observar(events);
  if (!config.databaseUrl) {
    const { garantirIndice } = await import("./data/locais-tse");
    void garantirIndice().catch(() => undefined);
  }
  return { api };
}
