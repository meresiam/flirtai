---
project: flirtai-kb
description: Knowledge Base do agente FlirtAI — extração estruturada de frameworks, heurísticas e técnicas de 9 referências em sedução/conquista
filosofia: Caminho D — Predador com Inteligência Situacional
generated: 2026-05-23
status: Fase 0 — Setup
---

# FlirtAI KB

Base de conhecimento que alimenta o agente FlirtAI via RAG. Não é clone de persona — é arsenal consultável de frameworks, heurísticas, técnicas, anti-padrões, scripts e diagnósticos extraídos de 9 referências (3 internacionais + 6 brasileiros).

## Filosofia: Caminho D — Predador com Inteligência Situacional

**Tom default:** caça calculada, estratégica, consciente de poder e dinâmica. Base: Greene + Strauss (early).

**Capacidade situacional:** decide quando trocar pra frame autêntico/vulnerabilidade real (Glover/Strauss late) quando o contexto exige — não como mistura morna, mas como leitura de quando "abaixar a guarda" é a jogada mais poderosa.

**O agente NÃO É:**
- Coach motivacional ("se ame primeiro")
- Manipulador grosseiro sem leitura
- Conselheiro romântico genérico

**O agente É:**
- Estrategista que lê o jogo
- Arsenal de técnicas + diagnósticos
- Capaz de decidir quando técnica entra e quando autenticidade ganha

## Estrutura

```
corpus/         # material bruto e processado por mind
  <mind>/
    raw/        # downloads originais (audio, vídeo, html)
    transcripts/  # transcrições Whisper + texto limpo
    processed/  # corpus consolidado pronto pra extração

kb/             # knowledge base final (output)
  frameworks/   # estruturas de pensamento
  heuristics/   # regras práticas
  techniques/   # manobras táticas
  anti-patterns/  # o que NÃO fazer
  scripts/      # falas prontas
  diagnostics/  # leitura de situação
  case-studies/  # exemplos narrativos
  synthesis/    # cross-mind: universal_principles + disagreements

manifests/      # listas de URLs/fontes por mind
scripts/        # scripts de scrape, download, transcrição
docs/           # documentação interna do projeto
```

## Pipeline

1. **Coleta** — URLs públicos em manifests/ → download via yt-dlp/curl → raw/
2. **Transcrição** — áudio/vídeo → Whisper → transcripts/
3. **Limpeza** — consolida + remove ruído → processed/
4. **Extração MMOS** — cognitive-analyst aplica DNA Mental focado em KB → kb/<categoria>/
5. **Cross-synthesis** — mmos-squad:debate compara minds → kb/synthesis/
6. **Ingestão RAG** — chunking + Voyage-3-large embeddings → Postgres pgvector
7. **Validação** — golden set de situações → retrieval relevance + coerência

## Status

- [x] Fase 0 — Setup
- [ ] Fase 1 — Coleta gringos (Greene, Strauss, Glover)
- [ ] Fase 2 — Transcrição + limpeza
- [ ] Fase 3 — Extração MMOS gringos
- [ ] Fase 4 — Cross-mind synthesis (3 minds)
- [ ] Fase 5 — Ingestão RAG v1
- [ ] Fase 6 — Coleta BR (6 minds via scrape IG/TikTok)
- [ ] Fase 7 — Extração MMOS BR
- [ ] Fase 8 — Cross-mind synthesis (9 minds)
- [ ] Fase 9 — Validação golden set PT-BR
