"use client";

import Link from "next/link";
import { Shell } from "@/components/shell";
import { buttonVariants } from "@/lib/design";

export default function NotFound() {
  return (
    <Shell title="Página não encontrada" lede="Este endereço não faz parte do Leva Voto.">
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </Shell>
  );
}
