import { connection } from "next/server";
import { getApp } from "@/server/boot";
import { HttpError } from "@/server/http/errors";

async function handle(request: Request): Promise<Response> {
  await connection();
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  let body: unknown;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return Response.json({ message: "Dados inválidos." }, { status: 400 });
      }
    }
  }
  try {
    const { api } = await getApp();
    const result = await api.dispatch(request.method, parts, request.headers, url.searchParams, body);
    return Response.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ message: "Não foi possível concluir agora." }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
