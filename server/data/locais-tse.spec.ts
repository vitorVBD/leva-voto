import { chaveSecao } from '../domain/geo';
import { parseCsvLine, registroDeLinha } from './locais-tse';

describe('locais do TSE', () => {
  it('quebra campos entre aspas', () => {
    expect(parseCsvLine('"RJ";"TRÊS RIOS";"Rua A; 10"')).toEqual(['RJ', 'TRÊS RIOS', 'Rua A; 10']);
  });

  it('reconhece zona e seção com zeros à esquerda', () => {
    const header = [
      'SG_UF',
      'NM_MUNICIPIO',
      'NR_ZONA',
      'NR_SECAO',
      'NM_LOCAL_VOTACAO',
      'DS_ENDERECO',
      'NM_BAIRRO',
      'NR_CEP',
      'NR_LATITUDE',
      'NR_LONGITUDE',
      'DS_SITU_SECAO_ACESSIBILIDADE',
    ];
    const linha =
      '"RJ";"TRÊS RIOS";"174";"0026";"ESCOLA EXEMPLO";"RUA A";"CENTRO";"25800000";"-22,116700";"-43,209400";"Com acessibilidade"';
    const registro = registroDeLinha(header, linha);
    expect(registro?.municipio).toBe('Três Rios');
    expect(registro?.local).toBe('Escola Exemplo');
    expect(chaveSecao('rj', 'Tres Rios', '0174', '0026')).toBe(
      chaveSecao(registro!.uf, registro!.municipio, registro!.zona, registro!.secao),
    );
  });
});
