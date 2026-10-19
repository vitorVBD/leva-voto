import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type AppConfig = {
  databaseUrl: string;
  enableRideFeature: boolean;
  acceptTimeoutMs: number;
  radiusStepKm: number;
  maxRadiusKm: number;
  initialRadiusKm: number;
  electionAt: string;
  electionEnd: string;
  adminToken: string;
  tseUrl: string;
  tseCacheDir: string;
  termoVersao: string;
  termoCondutaVersao: string;
};

export function applyEnvFile(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env) applyEnvFile();
  const producao = env.NODE_ENV === "production";
  const databaseUrl = env.DATABASE_URL ?? "";
  const adminToken = env.ADMIN_TOKEN ?? "";
  if (producao) {
    if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório em produção.");
    if (adminToken.length < 16 || adminToken === "dev-admin") {
      throw new Error(
        "ADMIN_TOKEN em produção precisa ter pelo menos 16 caracteres e não pode ser dev-admin.",
      );
    }
  }
  return {
    databaseUrl,
    enableRideFeature: env.ENABLE_RIDE_FEATURE === "true",
    acceptTimeoutMs: Number(env.ACCEPT_TIMEOUT_MS ?? 120_000),
    radiusStepKm: Number(env.RADIUS_STEP_KM ?? 2),
    maxRadiusKm: Number(env.MAX_RADIUS_KM ?? 10),
    initialRadiusKm: Number(env.INITIAL_RADIUS_KM ?? 2),
    electionAt: env.ELECTION_AT ?? "2026-10-25T08:00:00-03:00",
    electionEnd: env.ELECTION_END ?? "2026-10-25T17:00:00-03:00",
    adminToken: adminToken || "dev-admin",
    tseUrl:
      "https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor",
    tseCacheDir: env.TSE_CACHE_DIR ?? "",
    termoVersao: "2026-10-18",
    termoCondutaVersao: "2026-10-18",
  };
}
