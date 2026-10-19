import { DataStore } from '../store/types';

export async function expurgarDadosDeMobilidade(store: DataStore, corte: Date): Promise<number> {
  return store.expurgarMobilidade(corte);
}

export async function expurgarIdentificacaoDoEleitor(
  store: DataStore,
  corte: Date,
): Promise<number> {
  return store.expurgarDadosPessoais(corte);
}
