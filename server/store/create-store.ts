import { SECOES } from '../data/secoes';
import { DataStore } from './types';
import { MemoryStore } from './memory.store';

export async function createStore(databaseUrl: string): Promise<DataStore> {
  if (!databaseUrl) return new MemoryStore();
  const { PrismaStore } = await import("./prisma.store");
  const store = new PrismaStore();
  await store.ensureSecoes(SECOES);
  return store;
}
