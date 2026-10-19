export type TreContato = { nome: string; site: string };

const TRE: Record<string, TreContato> = {
  AC: { nome: 'TRE-AC', site: 'https://www.tre-ac.jus.br/' },
  AL: { nome: 'TRE-AL', site: 'https://www.tre-al.jus.br/' },
  AM: { nome: 'TRE-AM', site: 'https://www.tre-am.jus.br/' },
  AP: { nome: 'TRE-AP', site: 'https://www.tre-ap.jus.br/' },
  BA: { nome: 'TRE-BA', site: 'https://www.tre-ba.jus.br/' },
  CE: { nome: 'TRE-CE', site: 'https://www.tre-ce.jus.br/' },
  DF: { nome: 'TRE-DF', site: 'https://www.tre-df.jus.br/' },
  ES: { nome: 'TRE-ES', site: 'https://www.tre-es.jus.br/' },
  GO: { nome: 'TRE-GO', site: 'https://www.tre-go.jus.br/' },
  MA: { nome: 'TRE-MA', site: 'https://www.tre-ma.jus.br/' },
  MG: { nome: 'TRE-MG', site: 'https://www.tre-mg.jus.br/' },
  MS: { nome: 'TRE-MS', site: 'https://www.tre-ms.jus.br/' },
  MT: { nome: 'TRE-MT', site: 'https://www.tre-mt.jus.br/' },
  PA: { nome: 'TRE-PA', site: 'https://www.tre-pa.jus.br/' },
  PB: { nome: 'TRE-PB', site: 'https://www.tre-pb.jus.br/' },
  PE: { nome: 'TRE-PE', site: 'https://www.tre-pe.jus.br/' },
  PI: { nome: 'TRE-PI', site: 'https://www.tre-pi.jus.br/' },
  PR: { nome: 'TRE-PR', site: 'https://www.tre-pr.jus.br/' },
  RJ: { nome: 'TRE-RJ', site: 'https://www.tre-rj.jus.br/' },
  RN: { nome: 'TRE-RN', site: 'https://www.tre-rn.jus.br/' },
  RO: { nome: 'TRE-RO', site: 'https://www.tre-ro.jus.br/' },
  RR: { nome: 'TRE-RR', site: 'https://www.tre-rr.jus.br/' },
  RS: { nome: 'TRE-RS', site: 'https://www.tre-rs.jus.br/' },
  SC: { nome: 'TRE-SC', site: 'https://www.tre-sc.jus.br/' },
  SE: { nome: 'TRE-SE', site: 'https://www.tre-se.jus.br/' },
  SP: { nome: 'TRE-SP', site: 'https://www.tre-sp.jus.br/' },
  TO: { nome: 'TRE-TO', site: 'https://www.tre-to.jus.br/' },
};

export function treDe(uf: string): TreContato {
  return (
    TRE[uf.toUpperCase()] ?? {
      nome: 'TSE',
      site: 'https://www.tse.jus.br/',
    }
  );
}
