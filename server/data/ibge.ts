const cache = new Map<string, Promise<string[]>>();

export function listarMunicipiosIbge(uf: string): Promise<string[]> {
  const sigla = uf.trim().toUpperCase();
  const existente = cache.get(sigla);
  if (existente) return existente;
  const pendente = buscar(sigla).catch((error: unknown) => {
    cache.delete(sigla);
    throw error;
  });
  cache.set(sigla, pendente);
  return pendente;
}

async function buscar(uf: string): Promise<string[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) throw new Error('ibge');
  const data = (await response.json()) as { nome?: string }[];
  return data
    .map((item) => item.nome?.trim() ?? '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
