import { loadConfig } from "../config";
import { expurgarDadosDeMobilidade, expurgarIdentificacaoDoEleitor } from "../lgpd/purge";
import { createStore } from "../store/create-store";

async function main() {
  const config = loadConfig();
  const corte = process.argv[2] ? new Date(process.argv[2]) : new Date();
  if (Number.isNaN(corte.getTime())) {
    throw new Error("Data de corte inválida. Use um ISO, por exemplo 2026-10-26T00:00:00-03:00.");
  }
  const pessoais = process.argv.includes("--pessoais");
  const store = await createStore(config.databaseUrl);
  const mobilidade = await expurgarDadosDeMobilidade(store, corte);
  const identificacao = pessoais ? await expurgarIdentificacaoDoEleitor(store, corte) : 0;
  console.log(
    JSON.stringify({
      corte: corte.toISOString(),
      mobilidadeExpurgada: mobilidade,
      identificacaoExpurgada: identificacao,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
