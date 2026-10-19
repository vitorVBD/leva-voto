# Leva Voto

O site e a API ficam neste Next.js. O pareamento, o segredo de acesso e o Postgres com PostGIS rodam no servidor do Next. Em desenvolvimento, `DATABASE_URL` vazio usa memória. Em produção o processo exige `DATABASE_URL` e um `ADMIN_TOKEN` de pelo menos 16 caracteres, diferente de `dev-admin`.

A interface usa a cópia do design system em `vendor/design-system`.

## Desenvolvimento

```bash
npm ci
npx prisma generate
npm test
npm run dev
```

O site abre em http://localhost:3000. A API responde em `/api` no mesmo endereço.

## Produção

Na pasta que contém `leva-voto-frontend` e o `docker-compose.yml`:

```bash
POSTGRES_PASSWORD=uma-senha-longa \
ADMIN_TOKEN=um-token-de-coordenacao \
docker compose up --build
```

A senha não pode ter `@`, `:`, `/` nem espaço, porque entra na `DATABASE_URL`. O site sobe na porta 3000. O cache da base do TSE fica no volume `tse_cache`. Na subida, o container aplica `prisma migrate deploy`, inclusive o índice geográfico.

A coordenação fica em `/admin/voluntarios` e pede o `ADMIN_TOKEN`. Esse endereço não aparece na home.

Carona para o eleitor continua desligada, a menos que `ENABLE_RIDE_FEATURE=true`. O voluntário pode oferecer carona solidária nos dois casos.
