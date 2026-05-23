# v2 Roadmap

Ideias adiadas pra não inflar o MVP de entrega ao amigo.

## Items

- **`schema-supabase-original.sql`** — schema original (antes da migração pra Prisma). Mantido pra rastreabilidade.
- **Multi-device sync** — substituir Postgres-only por Supabase Realtime quando houver >2 usuários.
- **Análises agregadas** — tabela `Analysis` no Prisma existe sem leitura/escrita. Quando ativada, exibir card de "padrão por contato" (interesse médio, taxa de resposta, etc).
- **Green/Red flags automáticos** — coach extrai do contexto e popula campos `greenFlags`/`redFlags`. UI exibe na sidebar como badges coloridos.
- **Streaming de resposta** — Anthropic Messages API suporta SSE. Substituir resposta JSON-blocking por stream pra UX mais fluida.
- **Comando `/help`** — lista atalhos no chat (Nielsen H10).
- **Cancelar geração em curso** — `AbortController` na chamada `/api/coach` (Nielsen H3).
- **Google OAuth** — better-auth aceita 1 ENV adicional. Adicionar quando houver demanda.
