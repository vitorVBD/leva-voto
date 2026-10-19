import { AppConfig } from "../config";
import { DataStore } from "../store/types";
import { expurgarDadosDeMobilidade, expurgarIdentificacaoDoEleitor } from "./purge";

const LIMITE_TIMEOUT_MS = 2_147_483_647;

export class PurgeScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly store: DataStore,
    private readonly config: AppConfig,
  ) {}

  start(): void {
    const fim = new Date(this.config.electionEnd).getTime();
    if (Number.isNaN(fim)) return;
    const espera = Math.min(LIMITE_TIMEOUT_MS, Math.max(0, fim - Date.now()));
    this.timer = setTimeout(() => {
      void this.rodar();
    }, espera);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private async rodar(): Promise<void> {
    const corte = new Date(this.config.electionEnd);
    await expurgarDadosDeMobilidade(this.store, corte);
    await expurgarIdentificacaoDoEleitor(this.store, corte);
  }
}
