# Handoff — Sessão BR (Fase 6 do FlirtAI KB)

Esse documento é o prompt completo pra abrir uma **nova sessão Claude Code** que vai paralelizar a coleta dos 6 minds brasileiros enquanto a sessão principal continua processando os 3 gringos.

## Como usar

1. Abra um novo terminal
2. Rode `claude` numa nova sessão (ou abre o app)
3. Cola o conteúdo abaixo a partir do separador

---

## 📋 PROMPT DE HANDOFF

```
Você está sendo invocado para uma sessão paralela do projeto FlirtAI KB.

# Contexto do projeto

Estamos construindo a Knowledge Base do agente FlirtAI — sistema de relacionamento
focado em desenrolo, persuasão, sedução, leitura por mensagem e sagacidade verbal.

NÃO é marketing. NÃO é venda de produto. É ajudar o homem a se vender, levar a
mulher pra sair, ser desenrolado.

Filosofia escolhida: **Caminho D — Predador com Inteligência Situacional**.
Tom default: caça calculada/estratégica. Capacidade de trocar pra frame autêntico
quando contexto exige.

O projeto tá em `/Users/raphaelmeres/Desktop/flirtai-kb/`. Leia primeiro:
- `README.md` — visão e filosofia
- `TRACKER.md` — fases e estado
- `docs/schema-kb.yaml` — estrutura de saída de cada mind
- `manifests/greene-sources.yaml` — exemplo de como manifest deve ficar
- `scripts/01-download-audio.sh`, `scripts/02-transcribe.sh`, `scripts/03-scrape-greene-blog.py` — scripts existentes (reusáveis)
- `scripts/status.sh` — snapshot de progresso

A sessão paralela (que tá rodando agora num outro terminal) está processando os 3
minds gringos (Greene, Strauss, Glover): download, Whisper, blog scrape. Esses
estão em `corpus/greene/`, `corpus/strauss/`, `corpus/glover/`. **NÃO MEXA NEM
APAGUE NADA DESSAS PASTAS.**

# Seu escopo: 6 minds brasileiros

Esses são os caras que você vai descobrir, scrapear e baixar conteúdo de áudio/vídeo.
NÃO transcreva ainda (Whisper local tá ocupado pela outra sessão até liberar a GPU
Apple Neural Engine — só rode transcrição quando combinar com o usuário).

## Tier 1 — Profundidade conceitual (priorize esses)

**1. Lucas Krausche / Desenrolado** — @lkrausche
- 933K IG + 1M TikTok
- Posiciona como "psicanalista especialista em relacionamentos"
- Construiu a marca Desenrolado com vários infoprodutos
- Provavelmente o mais denso conceitualmente. Cara fala em framework.
- **Foco da coleta:** vídeos longos (Reels longos, Lives, YouTube se tiver),
  posts que expliquem método/framework, artigos do Desenrolado

**2. Murilo Vilaverde** — @vilaverdemurilo
- 265K IG
- PUA brasileiro: "abordei +3000 mulheres de +40 países"
- "Maior comunidade de sedução do mundo com +10 mil alunos"
- Conteúdo PUA puro com vídeos de abordagem em campo + mentoria 1:1
- Tem reality 24h transformando tímidos em sedutores
- **Foco:** vídeos de abordagem em campo, explicação de método,
  análise de interação ao vivo

## Tier 2 — Volume + persona forte

**3. Erick Ronaldo** — @erickronaldo
- 1M IG + 1.8M TikTok
- Mora em Miami, faz abordagens internacionais
- Um dos maiores do nicho em alcance
- **Foco:** abordagens reais, padrões de aproximação

**4. JV Pimentel** — @jvpimeentel
- 60K IG
- Estilo cafajeste-carismático, bem festa/balada
- **Foco:** persona/tom (não framework) — captura forma de falar,
  banter, sagacidade verbal de balada

## Tier 3 — Niche

**5. Pedrinho UOL** — @pedrinhouol (TikTok)
- Cantadas, carnaval, abordagens cômicas
- **Foco:** humor/quebra-gelo cômico (não framework)

**6. Matheus Donadelli / Alpha Spirit**
- Curso voltado a NoFap + técnicas de sedução
- Proposta: "transmutar a energia" do homem pra torná-lo mais atraente
- **Foco:** filosofia de masculinidade/NoFap, conexão energia/atratividade

# O que você vai entregar

Para CADA um dos 6 minds:

## A) Manifest YAML
Arquivo em `manifests/<mind_id>-sources.yaml` no mesmo formato do
`greene-sources.yaml`. Inclua:
- mind_id (snake_case): krausche, vilaverde, erick_ronaldo, jv_pimentel,
  pedrinho_uol, donadelli
- display_name
- origin: br
- tier: foundation | depth | flavor (use o tier definido acima)
- philosophical_alignment: greene_axis | glover_axis | hybrid (você decide
  baseado no perfil)
- source_material: lista de URLs categorizadas
- notes: particularidades técnicas (cookies necessárias? rate limits? etc)
- Plano de coleta com volume estimado

## B) Lista de URLs em `manifests/youtube_urls/<mind_id>.txt`
URLs YouTube/TikTok pra yt-dlp baixar (yt-dlp suporta TikTok nativo).
Pra Instagram Reels, use yt-dlp também (suporta IG mas pode precisar
cookies — flag isso no manifest).

## C) Audio MP3 baixado em `corpus/<mind_id>/raw/audio/`
Use `scripts/01-download-audio.sh <mind_id>` — já está pronto. Antes de rodar,
crie a pasta: `mkdir -p corpus/<mind_id>/raw/{audio,transcripts,processed}`.

## D) NÃO TRANSCREVER AGORA
Whisper PT-BR roda em outra fase. Você para no áudio baixado.
Tem que rodar `bash scripts/02-transcribe.sh <mind_id> --language pt`
depois — mas só quando a outra sessão liberar a GPU. O usuário vai avisar.

# Coordenação com a sessão principal

- Rode `bash scripts/status.sh` periodicamente — vai mostrar progresso seu E da
  outra sessão (que mexe em greene/strauss/glover).
- **NÃO** edite arquivos em `corpus/greene/`, `corpus/strauss/`, `corpus/glover/`.
- **NÃO** rode mlx-whisper enquanto a outra sessão estiver transcrevendo.
- Quando concluir milestone, atualize o `TRACKER.md` marcando o que terminou.

# Pipeline sugerido

```
Fase A — Discovery (web search + scrape inicial)
  └─ Pra cada um dos 6: descobrir todas as fontes de áudio/vídeo
     disponíveis (YouTube se tiver, TikTok, IG Reels, podcasts BR)

Fase B — Manifests
  └─ Salvar manifests/<mind>-sources.yaml e youtube_urls/<mind>.txt

Fase C — Downloads paralelos (yt-dlp)
  └─ 6 processos paralelos baixando em background
  └─ Logs em scripts/logs/download-<mind>.log

Fase D — Validação
  └─ Conferir volume baixado, qualidade do áudio, ver se faltam minds
     que precisam abordagem alternativa (ex: Instagram via instaloader)

Fase E — PARE AQUI
  └─ Não transcreva. Pingue o usuário pra ele decidir quando rodar Whisper.
```

# Dicas técnicas

- yt-dlp suporta TikTok direto: `yt-dlp -x --audio-format mp3 <url>`
- IG Reels: yt-dlp também consegue, mas alguns vão exigir cookies
  do navegador (`--cookies-from-browser chrome`)
- Pra descobrir vídeos do canal/perfil de um IG, scroll manual no perfil
  é necessário pra capturar URLs (não tem API pública estável). Ou usa
  instaloader (`pip install instaloader`).
- TikTok: `yt-dlp "https://www.tiktok.com/@username"` baixa o perfil inteiro
- Pra Krausche/Vilaverde/Donadelli, talvez tenha YouTube — busca primeiro

# Comece assim

1. Leia README.md, TRACKER.md, schema-kb.yaml do projeto
2. Rode `bash scripts/status.sh` pra ver o estado da outra sessão
3. Comece pelo Tier 1 — Lucas Krausche (Desenrolado) primeiro (mais denso)
4. Faça discovery + manifest + download
5. Depois Vilaverde, depois Tier 2, depois Tier 3
6. Reporte ao usuário quando terminar cada manifest

NÃO faça transcrição. Pare no áudio baixado. Aguarde sinal verde do usuário.
```

---

## Pontos críticos pra lembrar

- A outra sessão (essa, atual) tá ocupada com a Neural Engine via mlx-whisper
- Os arquivos `scripts/01-download-audio.sh`, `02-transcribe.sh`, `03-scrape-greene-blog.py` são reusáveis
- O schema da KB já tá definido em `docs/schema-kb.yaml`
- A nova sessão NÃO precisa instalar nada (yt-dlp, ffmpeg, mlx-whisper já instalados globalmente)
- Coordenação via `scripts/status.sh` e `TRACKER.md`
