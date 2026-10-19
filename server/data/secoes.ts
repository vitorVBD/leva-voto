import { normalizeText } from '../domain/geo';
import { Secao } from '../domain/types';

/**
 * Amostra ilustrativa para desenvolvimento. Não substitui a consulta oficial do TSE.
 * Coordenadas aproximadas de centros urbanos, só para exercitar rota e pareamento.
 */
export const SECOES: Secao[] = [
  {
    id: 'sp-sao-paulo-1-1',
    uf: 'SP',
    municipio: 'São Paulo',
    zona: '1',
    secao: '1',
    local: 'Escola Municipal de Demonstração República',
    endereco: 'Praça da República, 100, República, São Paulo - SP',
    bairro: 'República',
    latitude: -23.5436,
    longitude: -46.6427,
    acessibilidade: 'Rampa na entrada principal e sanitário acessível no térreo.',
  },
  {
    id: 'sp-sao-paulo-1-2',
    uf: 'SP',
    municipio: 'São Paulo',
    zona: '1',
    secao: '2',
    local: 'Escola Estadual de Demonstração Consolação',
    endereco: 'Rua da Consolação, 2000, Consolação, São Paulo - SP',
    bairro: 'Consolação',
    latitude: -23.555,
    longitude: -46.66,
    acessibilidade: 'Entrada com degraus. Não há rampa informada nesta base de demonstração.',
  },
  {
    id: 'sp-campinas-20-10',
    uf: 'SP',
    municipio: 'Campinas',
    zona: '20',
    secao: '10',
    local: 'Escola de Demonstração Centro Campinas',
    endereco: 'Rua Treze de Maio, 100, Centro, Campinas - SP',
    bairro: 'Centro',
    latitude: -22.9056,
    longitude: -47.0608,
    acessibilidade: 'Rampa lateral e corrimão nas escadas internas.',
  },
  {
    id: 'rj-rio-de-janeiro-5-12',
    uf: 'RJ',
    municipio: 'Rio de Janeiro',
    zona: '5',
    secao: '12',
    local: 'Escola de Demonstração Cinelândia',
    endereco: 'Praça Floriano, 50, Centro, Rio de Janeiro - RJ',
    bairro: 'Centro',
    latitude: -22.9106,
    longitude: -43.1729,
    acessibilidade: 'Acesso plano pela praça. Sanitário acessível no térreo.',
  },
  {
    id: 'mg-belo-horizonte-3-8',
    uf: 'MG',
    municipio: 'Belo Horizonte',
    zona: '3',
    secao: '8',
    local: 'Escola de Demonstração Savassi',
    endereco: 'Praça Diogo de Vasconcelos, 80, Savassi, Belo Horizonte - MG',
    bairro: 'Savassi',
    latitude: -19.938,
    longitude: -43.933,
    acessibilidade: 'Rampa na entrada e elevador até o segundo andar.',
  },
  {
    id: 'df-brasilia-1-4',
    uf: 'DF',
    municipio: 'Brasília',
    zona: '1',
    secao: '4',
    local: 'Escola de Demonstração Asa Sul',
    endereco: 'EQS 202/302, Asa Sul, Brasília - DF',
    bairro: 'Asa Sul',
    latitude: -15.804,
    longitude: -47.893,
    acessibilidade: 'Calçada rebaixada e rampa de acesso à quadra.',
  },
  {
    id: 'ba-salvador-7-15',
    uf: 'BA',
    municipio: 'Salvador',
    zona: '7',
    secao: '15',
    local: 'Escola de Demonstração Comércio',
    endereco: 'Rua Chile, 20, Comércio, Salvador - BA',
    bairro: 'Comércio',
    latitude: -12.974,
    longitude: -38.513,
    acessibilidade: 'Entrada em ladeira. Há rampa alternativa pela lateral.',
  },
  {
    id: 'pe-recife-4-6',
    uf: 'PE',
    municipio: 'Recife',
    zona: '4',
    secao: '6',
    local: 'Escola de Demonstração Santo Antônio',
    endereco: 'Avenida Dantas Barreto, 500, Santo Antônio, Recife - PE',
    bairro: 'Santo Antônio',
    latitude: -8.063,
    longitude: -34.878,
    acessibilidade: 'Rampa na portaria e piso tátil no corredor principal.',
  },
  {
    id: 'rs-porto-alegre-2-9',
    uf: 'RS',
    municipio: 'Porto Alegre',
    zona: '2',
    secao: '9',
    local: 'Escola de Demonstração Centro Histórico',
    endereco: 'Rua dos Andradas, 1000, Centro Histórico, Porto Alegre - RS',
    bairro: 'Centro Histórico',
    latitude: -30.031,
    longitude: -51.23,
    acessibilidade: 'Sanitário acessível no térreo. Escada na entrada secundária.',
  },
  {
    id: 'ce-fortaleza-6-3',
    uf: 'CE',
    municipio: 'Fortaleza',
    zona: '6',
    secao: '3',
    local: 'Escola de Demonstração Centro Fortaleza',
    endereco: 'Rua Barão do Rio Branco, 100, Centro, Fortaleza - CE',
    bairro: 'Centro',
    latitude: -3.727,
    longitude: -38.527,
    acessibilidade: 'Rampa e corrimão na entrada principal.',
  },
  {
    id: 'pr-curitiba-8-11',
    uf: 'PR',
    municipio: 'Curitiba',
    zona: '8',
    secao: '11',
    local: 'Escola de Demonstração Centro Curitiba',
    endereco: 'Rua XV de Novembro, 300, Centro, Curitiba - PR',
    bairro: 'Centro',
    latitude: -25.429,
    longitude: -49.271,
    acessibilidade: 'Acesso plano pela calçada e sanitário acessível.',
  },
];

export const CENTROIDES: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  SECOES.map((secao) => [
    `${secao.uf}|${secao.municipio}`,
    { lat: secao.latitude, lng: secao.longitude },
  ]),
);

export function centroideDe(uf: string, municipio: string): { lat: number; lng: number } | null {
  const alvo = normalizeText(municipio);
  for (const [key, value] of Object.entries(CENTROIDES)) {
    const [chaveUf, chaveMunicipio] = key.split('|');
    if (chaveUf === uf.toUpperCase() && normalizeText(chaveMunicipio) === alvo) return value;
  }
  return null;
}
