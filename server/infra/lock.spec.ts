import { MemoryLock } from './lock';

describe('trava de aceite', () => {
  it('entrega a chave só para o primeiro e libera depois do prazo', async () => {
    let now = 1_000;
    const lock = new MemoryLock(() => now);
    const first = await lock.acquire('leva:aceite:pedido', 5);
    const second = await lock.acquire('leva:aceite:pedido', 5);
    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
    now += 5_001;
    const third = await lock.acquire('leva:aceite:pedido', 5);
    expect(third).toEqual(expect.any(String));
  });

  it('solta a chave só com o mesmo token', async () => {
    const lock = new MemoryLock();
    const token = await lock.acquire('pedido', 5);
    await lock.release('pedido', 'outro');
    expect(await lock.acquire('pedido', 5)).toBeNull();
    await lock.release('pedido', token!);
    expect(await lock.acquire('pedido', 5)).toEqual(expect.any(String));
  });
});
