# Leva Voto

Next.js. A interface usa a cópia do design system em `vendor/design-system`.

`NEXT_PUBLIC_API_URL` é gravada no build. O exemplo está em `.env.example`.

```bash
npm ci
npm run build
npm start
```

A imagem de produção está no `Dockerfile`. O compose da pasta pai publica o site na porta 3000.
