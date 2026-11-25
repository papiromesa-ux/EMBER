#!/data/data/com.termux/files/usr/bin/bash
# Arranca Ember IA en Termux.
# Uso:  ./run.sh            (usa el modelo por defecto)
#       EMBER_MODEL=otro.gguf ./run.sh

cd "$(dirname "$0")" || exit 1

# Evita que Android duerma el proceso mientras generas respuestas.
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

export EMBER_MODEL="${EMBER_MODEL:-qwen1_5-1_8b-chat-q4_k_m.gguf}"
export EMBER_CTX="${EMBER_CTX:-2048}"
export EMBER_THREADS="${EMBER_THREADS:-4}"
export EMBER_BATCH="${EMBER_BATCH:-256}"
export EMBER_PORT="${EMBER_PORT:-8000}"

echo "Ember IA"
echo "  modelo:  $EMBER_MODEL"
echo "  ctx:     $EMBER_CTX"
echo "  hilos:   $EMBER_THREADS"
echo "  puerto:  $EMBER_PORT"
echo

python main.py

command -v termux-wake-unlock >/dev/null 2>&1 && termux-wake-unlock
