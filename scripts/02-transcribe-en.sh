#!/bin/bash
# Transcreve MP3s de um mind EN via mlx-whisper (local, Apple Silicon).
# Versão EN — language='en'. Idêntico ao 02-transcribe-br.sh mas com idioma inglês.
# Uso: ./02-transcribe-en.sh <mind_id>

set -e

MIND="$1"
if [ -z "$MIND" ]; then
    echo "Uso: $0 <mind_id>"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIO_DIR="$PROJECT_ROOT/corpus/${MIND}/raw/audio"
OUTPUT_DIR="$PROJECT_ROOT/corpus/${MIND}/transcripts"
LOG_FILE="$PROJECT_ROOT/scripts/logs/transcribe-${MIND}.log"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

MODEL="mlx-community/whisper-large-v3-mlx"

echo "=== Transcribe EN :: $MIND :: $(date) ===" | tee "$LOG_FILE"
echo "Audio dir: $AUDIO_DIR" | tee -a "$LOG_FILE"
echo "Output:    $OUTPUT_DIR" | tee -a "$LOG_FILE"
echo "Model:     $MODEL" | tee -a "$LOG_FILE"
echo "Language:  en" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

shopt -s nullglob
files=("$AUDIO_DIR"/*.mp3)
total=${#files[@]}
echo "Total files: $total" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

i=0
for f in "${files[@]}"; do
    i=$((i+1))
    base=$(basename "$f" .mp3)
    out="$OUTPUT_DIR/${base}.txt"

    if [ -f "$out" ] && [ -s "$out" ]; then
        echo "[$i/$total] SKIP (already exists): $base" | tee -a "$LOG_FILE"
        continue
    fi

    echo "[$i/$total] Transcribing: $base" | tee -a "$LOG_FILE"
    start=$(date +%s)

    python3 -c "
import mlx_whisper
result = mlx_whisper.transcribe(
    '$f',
    path_or_hf_repo='$MODEL',
    language='en',
    verbose=False
)
with open('$out', 'w') as fp:
    fp.write(result['text'])
" 2>&1 | tee -a "$LOG_FILE" || echo "ERROR on $base" | tee -a "$LOG_FILE"

    end=$(date +%s)
    elapsed=$((end-start))
    echo "    done in ${elapsed}s" | tee -a "$LOG_FILE"
done

echo "" | tee -a "$LOG_FILE"
echo "=== Transcribe EN finished :: $MIND :: $(date) ===" | tee -a "$LOG_FILE"
ls -lh "$OUTPUT_DIR" | tee -a "$LOG_FILE"
