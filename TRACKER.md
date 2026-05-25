# 📊 FlirtAI KB — Tracker de Fases

> Rode `bash scripts/status.sh` a qualquer momento pra ver progresso em tempo real.
> Este arquivo mostra a estrutura macro e as fases. O status.sh dá os números atuais.

```
██████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░  Fase 1 (download gringos)
████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Fase 2 (transcrição gringos)
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Fase 3+
██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Fase 6 (coleta BR — sessão paralela)
```

---

## 🎯 Pipeline completo — 9 fases

### Fase 0 — Setup ✅ DONE
- [x] Estrutura de pastas (`corpus/`, `kb/`, `manifests/`, `scripts/`)
- [x] README com filosofia Caminho D
- [x] Schema da KB (`docs/schema-kb.yaml`)
- [x] Manifests com URLs públicos (Greene, Strauss, Glover)
- [x] Scripts de pipeline (download, transcribe, scrape, orquestrador)
- [x] Tools instaladas: yt-dlp, ffmpeg, mlx-whisper

### Fase 1 — Coleta gringos 🟡 EM EXECUÇÃO
**Substep 1.1 — Download audio (yt-dlp)**
- [x] Greene: 14/14 arquivos (1.8GB) ✅
- [x] Strauss: 6/6 arquivos (237MB) ✅
- [x] Glover: 4-5 arquivos (237MB) ✅

**Substep 1.2 — Scrape blog Greene**
- [ ] Re-rodando após fix do bug "untitled" (60 URLs identificadas, salvando agora com slug correto)

### Fase 2 — Transcrição mlx-whisper 🟡 EM EXECUÇÃO
- [ ] Greene: file 1/14 em andamento (large-v3, M5 Pro, ~10-15min/file)
- [ ] Strauss: aguardando greene completar
- [ ] Glover: aguardando strauss completar

ETA Fase 2 completa: **~6-10h** (sequencial pra não saturar GPU)

### Fase 3 — Extração MMOS 🔒 BLOQUEADA POR FASE 2
- [ ] Consolidação corpus por mind (`processed/full-corpus.md`)
- [ ] Roda `mmos-squad:cognitive-analyst` com prompt KB-emitter (schema customizado)
- [ ] Output: 3 arquivos YAML estruturados (frameworks/heurísticas/técnicas/anti-padrões/scripts/diagnósticos)

### Fase 4 — Cross-mind synthesis 🔒
- [ ] `mmos-squad:debate` confronta os 3 minds em cada tema
- [ ] Identifica `universal_principles` (todos concordam)
- [ ] Identifica `disagreements` (Greene vs Glover) — você decide tom situacional
- [ ] Output: manifesto "filosofia FlirtAI" + KB consolidada

### Fase 5 — Ingestão RAG 🔒
- [ ] Setup Postgres + pgvector
- [ ] Chunking semântico
- [ ] Embeddings via Voyage-3-large
- [ ] Indexação com tags de situação
- [ ] API de retrieval

### Fase 6 — Coleta BR 🟡 EM EXECUÇÃO (sessão paralela)

**Substep 6.0 — Discovery + Manifests** ✅ DONE (2026-05-24)
- [x] Krausche: YT @LucasDesenrolado (120 vids) + 9 podcasts = 129 URLs / ~26h
- [x] Vilaverde: YT channel ID UCByvQuOKhc... (158 vids) / ~30h
- [x] Erick Ronaldo: top 80 YT >=10min (curado de 538 totais) / ~32h
- [x] Pedrinho UOL: top 100 TikTok @pedrinhuol (de 764 clips) / ~1.5h
- [x] Donadelli: 8 vídeos + 1 playlist (canal próprio foi deletado) / ~6h
- [⚠️] JV Pimentel: BLOQUEADO (TT private + IG yt-dlp/instaloader retornam 403)
       → requer coleta manual de URLs ou login autenticado. Manifest com
       instruções alternativas em `manifests/jv_pimentel-sources.yaml`.

**Substep 6.1 — Download audio (yt-dlp paralelo)** 🟡 EM EXECUÇÃO
- [ ] Krausche
- [ ] Vilaverde
- [ ] Erick Ronaldo
- [ ] Pedrinho UOL
- [ ] Donadelli
- 5 processos yt-dlp em paralelo, logs em `scripts/logs/download-<mind>.log`

**Substep 6.2 — Whisper PT-BR** 🔒 BLOQUEADA
- Aguardando sinal verde do usuário (não rodar enquanto Fase 2 gringos
  ainda usa o ANE). Total estimado a transcrever: ~95h áudio.

### Fase 7 — Extração BR 🔒
- [ ] MMOS aplicado a cada um dos 6 BR

### Fase 8 — Re-synthesis 9 minds 🔒
- [ ] Reprocessa synthesis com os 9 minds (3 USA + 6 BR)
- [ ] Atualiza universal_principles + disagreements

### Fase 9 — Validação 🔒
- [ ] Golden set PT-BR com 30 situações típicas
- [ ] Mede retrieval relevance + coerência de resposta
- [ ] Iteração final

---

## 🗺️ Como navegar quando quiser ver detalhe

| O quê | Onde |
|---|---|
| Filosofia + status macro | `README.md` |
| Schema da KB | `docs/schema-kb.yaml` |
| Fontes por mind | `manifests/<mind>-sources.yaml` |
| URLs YouTube | `manifests/youtube_urls/<mind>.txt` |
| Áudios baixados | `corpus/<mind>/raw/audio/*.mp3` |
| Discovery raw dumps BR | `scripts/discovery/<mind>_{yt,tt}.txt` |
| Blog Greene | `corpus/greene/raw/blog/*.md` |
| Transcrições | `corpus/<mind>/transcripts/*.txt` |
| Logs do pipeline | `scripts/logs/*.log` |
| **Status atual** | `bash scripts/status.sh` |

---

## 🎚️ Filosofia (Caminho D — Predador com Inteligência Situacional)

**Default:** caça calculada, estratégica, consciente de poder.
Base: Greene (predominante) + Strauss early (técnica de campo).

**Capacidade:** trocar pra frame autêntico/vulnerabilidade quando contexto exige
(Glover/Strauss late). Não mistura morna — escolha de jogada.
