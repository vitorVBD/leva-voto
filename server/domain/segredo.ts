import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function novoSegredo(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAcesso(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex');
}

export function segredoConfere(informado: string | undefined, hash: string): boolean {
  if (!informado || !hash) return false;
  const atual = createHash('sha256').update(informado).digest();
  const esperado = Buffer.from(hash, 'hex');
  if (atual.length !== esperado.length) return false;
  return timingSafeEqual(atual, esperado);
}

export function tokenConfere(informado: string | undefined, esperado: string): boolean {
  const atual = createHash('sha256').update(informado ?? '').digest();
  const oficial = createHash('sha256').update(esperado).digest();
  return Boolean(informado) && timingSafeEqual(atual, oficial);
}
