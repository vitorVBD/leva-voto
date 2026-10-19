"use client";

import { useId, useMemo, useState } from "react";
import { TextField } from "@/components/choices";

function semAcento(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function MunicipioField({
  value,
  onChange,
  cidades,
  estado,
  uf,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  cidades: string[];
  estado: "idle" | "carregando" | "pronto" | "erro";
  uf: string;
  error?: string;
}) {
  const listaId = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const sugestoes = useMemo(() => {
    const termo = semAcento(value.trim());
    const base = termo ? cidades.filter((nome) => semAcento(nome).includes(termo)) : cidades;
    return base.slice(0, 8);
  }, [cidades, value]);

  function escolher(nome: string) {
    onChange(nome);
    setAberto(false);
  }

  const ajuda =
    estado === "carregando"
      ? `Carregando os municípios de ${uf}…`
      : estado === "erro"
        ? "Não foi possível carregar a lista de municípios. Digite o nome oficial da cidade."
        : estado === "pronto" && value.trim() && sugestoes.length === 0
          ? `Nenhum município de ${uf} com esse nome.`
          : estado === "pronto"
            ? `Digite para filtrar os ${cidades.length} municípios de ${uf}.`
            : "Escolha a UF para ver os municípios.";

  return (
    <div className="relative flex flex-col gap-1">
      <TextField
        label="Município"
        value={value}
        error={error}
        role="combobox"
        aria-expanded={aberto && sugestoes.length > 0}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setAtivo(0);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={(event) => {
          if (!aberto || sugestoes.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setAtivo((atual) => (atual + 1) % sugestoes.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setAtivo((atual) => (atual - 1 + sugestoes.length) % sugestoes.length);
          } else if (event.key === "Enter" && aberto) {
            event.preventDefault();
            const nome = sugestoes[ativo];
            if (nome) escolher(nome);
          } else if (event.key === "Escape") setAberto(false);
        }}
      />
      <p className="text-sm text-muted-foreground">{ajuda}</p>
      {aberto && sugestoes.length > 0 ? (
        <ul
          id={listaId}
          role="listbox"
          aria-label={`Municípios de ${uf}`}
          className="absolute top-16 z-10 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {sugestoes.map((nome, index) => (
            <li key={nome} role="option" aria-selected={index === ativo}>
              <button
                type="button"
                className={`w-full rounded-md px-3 py-2 text-left text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${index === ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => escolher(nome)}
              >
                {nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
