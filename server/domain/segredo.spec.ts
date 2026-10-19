import { hashAcesso, segredoConfere, tokenConfere } from './segredo';

describe('segredo de acesso', () => {
  it('confere o segredo certo e rejeita o errado', () => {
    const hash = hashAcesso('codigo-do-pedido');
    expect(segredoConfere('codigo-do-pedido', hash)).toBe(true);
    expect(segredoConfere('outro', hash)).toBe(false);
    expect(segredoConfere(undefined, hash)).toBe(false);
  });

  it('compara o token da coordenação sem aceitar vazio', () => {
    expect(tokenConfere('dev-admin', 'dev-admin')).toBe(true);
    expect(tokenConfere('outro', 'dev-admin')).toBe(false);
    expect(tokenConfere(undefined, 'dev-admin')).toBe(false);
  });
});
