import { Body, Card, Heading } from "@/lib/design";

export function Orientacao({
  local,
  tre,
}: {
  local: {
    nome: string;
    endereco: string;
    acessibilidade: string;
    zona: string;
    secao: string;
  };
  tre: { nome: string; site: string };
}) {
  const passos = [
    `O local é ${local.nome}, na zona ${local.zona}, seção ${local.secao}.`,
    `Endereço: ${local.endereco}.`,
    `Acessibilidade informada na base de demonstração: ${local.acessibilidade}`,
    "Leve um documento oficial com foto. O título digital no aplicativo e-Título também vale.",
    "A votação costuma ir das 8h às 17h. Confirme o horário no TSE.",
  ];
  return (
    <Card>
      <Heading>Como chegar com calma</Heading>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-base leading-6">
        {passos.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
      <Body>
        Contato do {tre.nome}:{" "}
        <a
          className="font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          href={tre.site}
          target="_blank"
          rel="noopener noreferrer"
        >
          site oficial (abre em nova aba)
        </a>
        .
      </Body>
    </Card>
  );
}
