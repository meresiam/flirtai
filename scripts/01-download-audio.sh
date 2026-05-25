#!/bin/bash
# Download audio de URLs YouTube via yt-dlp para um mind específico.
# Uso: ./01-download-audio.sh <mind_id>
# Exemplo: ./01-download-audio.sh greene

set -e

MIND="$1"
if [ -z "$MIND" ]; then
    echo "Uso: $0 <mind_id>"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL_FILE="$PROJECT_ROOT/manifests/youtube_urls/${MIND}.txt"
OUTPUT_DIR="$PROJECT_ROOT/corpus/${MIND}/raw/audio"
LOG_FILE="$PROJECT_ROOT/scripts/logs/download-${MIND}.log"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

echo "=== Download audio :: $MIND :: $(date) ===" | tee "$LOG_FILE"
echo "URL file: $URL_FILE" | tee -a "$LOG_FILE"
echo "Output:   $OUTPUT_DIR" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

yt-dlp \
    -x \
    --audio-format mp3 \
    --audio-quality 0 \
    --no-playlist-reverse \
    --ignore-errors \
    --no-warnings \
    --restrict-filenames \
    --output "$OUTPUT_DIR/%(title).100s.%(ext)s" \
    --batch-file "$URL_FILE" \
    2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== Download finished :: $MIND :: $(date) ===" | tee -a "$LOG_FILE"
echo "Files:" | tee -a "$LOG_FILE"
ls -lh "$OUTPUT_DIR" | tee -a "$LOG_FILE"
