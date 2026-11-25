"""
Ember IA — servidor local para Termux (v0.4)

Arranca un modelo GGUF con llama.cpp y sirve la web de Ember.
Pensado para correr en un Android de 6-8 GB de RAM, sin nube.

Uso:
    python main.py
o bien:
    uvicorn main:app --host 0.0.0.0 --port 8000

Variables de entorno (opcionales):
    EMBER_MODEL    ruta o nombre del .gguf   (def. qwen1_5-1_8b-chat-q4_k_m.gguf)
    EMBER_CTX      tamaño de contexto        (def. 2048)
    EMBER_THREADS  hilos de CPU              (def. 4)
    EMBER_BATCH    batch de llama.cpp        (def. 256)
    EMBER_PORT     puerto                    (def. 8000)
"""

import ctypes
import json
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

# ----------------------------------------------------------------------------
# Rutas y configuración
# ----------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = os.environ.get("EMBER_MODEL", "qwen1_5-1_8b-chat-q4_k_m.gguf")
N_CTX = int(os.environ.get("EMBER_CTX", "2048"))
N_THREADS = int(os.environ.get("EMBER_THREADS", "4"))
N_BATCH = int(os.environ.get("EMBER_BATCH", "256"))
PORT = int(os.environ.get("EMBER_PORT", "8000"))

MAX_HISTORIAL = 8
MAX_TOKENS = {"bajo": 512, "medio": 768, "alto": 1024}
PASADAS = {"bajo": 1, "medio": 1, "alto": 2}

# Solo estos archivos se sirven por HTTP. El .gguf y el código quedan fuera.
ARCHIVOS_WEB = {
    "index.html": "text/html; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
    "app.js": "application/javascript; charset=utf-8",
    "manifest.webmanifest": "application/manifest+json",
    "icon.svg": "image/svg+xml",
}

MEMORIA_DIRS = {
    "privada": BASE_DIR / "memoria_privada",
    "publica": BASE_DIR / "memoria_publica",
    "oficial": BASE_DIR / "memoria_oficial",
}
for _d in MEMORIA_DIRS.values():
    _d.mkdir(parents=True, exist_ok=True)

# ----------------------------------------------------------------------------
# Termux: precargar libllama antes de importar llama_cpp
# ----------------------------------------------------------------------------

_TERMUX_LIB = (
    "/data/data/com.termux/files/usr/lib/python3.14/"
    "site-packages/llama_cpp/lib/libllama.so"
)
if os.path.exists(_TERMUX_LIB):
    try:
        ctypes.CDLL(_TERMUX_LIB)
    except OSError as exc:
        print(f"[ember] aviso: no se pudo precargar libllama: {exc}")

try:
    from llama_cpp import Llama
except Exception as exc:  # el servidor igual arranca, pero sin cerebro
    Llama = None
    print(f"[ember] aviso: llama-cpp-python no disponible: {exc}")

# ----------------------------------------------------------------------------
# Memoria en disco (una lista JSON por carpeta)
# ----------------------------------------------------------------------------


def _mem_path(tipo: str) -> Path:
    return MEMORIA_DIRS[tipo] / "memoria.json"


def _leer_memoria(tipo: str) -> list:
    p = _mem_path(tipo)
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def _escribir_memoria(tipo: str, items: list) -> None:
    _mem_path(tipo).write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def leer_toda_la_memoria() -> list:
    salida = []
    for tipo in MEMORIA_DIRS:
        for item in _leer_memoria(tipo):
            copia = dict(item)
            copia["tipo"] = tipo
            salida.append(copia)
    salida.sort(key=lambda x: x.get("ts", 0), reverse=True)
    return salida


def guardar_dato(tema: str, dato: str, persona: str = "Alexi", tipo: str = "privada") -> dict:
    tema = (tema or "").strip()
    dato = (dato or "").strip()
    if not tema or not dato:
        raise ValueError("tema y dato son obligatorios")
    if tipo not in MEMORIA_DIRS:
        tipo = "privada"

    items = _leer_memoria(tipo)
    for item in items:
        if item.get("tema", "").lower() == tema.lower():
            item.update({"dato": dato, "persona": persona, "ts": time.time()})
            _escribir_memoria(tipo, items)
            return item

    item = {
        "id": uuid.uuid4().hex[:10],
        "tema": tema,
        "dato": dato,
        "persona": persona,
        "ts": time.time(),
    }
    items.append(item)
    _escribir_memoria(tipo, items)
    return item


def borrar_dato(item_id: str) -> bool:
    for tipo in MEMORIA_DIRS:
        items = _leer_memoria(tipo)
        restantes = [i for i in items if i.get("id") != item_id]
        if len(restantes) != len(items):
            _escribir_memoria(tipo, restantes)
            return True
    return False


# ----------------------------------------------------------------------------
# Estado del modelo
# ----------------------------------------------------------------------------


class _Estado:
    llm = None
    error = None
    modelo = MODEL_PATH
    lock = threading.Lock()


estado = _Estado()


def _ruta_modelo() -> str:
    p = Path(MODEL_PATH).expanduser()
    if not p.is_absolute():
        p = BASE_DIR / p
    return str(p)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    estado.modelo = _ruta_modelo()
    if Llama is None:
        estado.error = "llama-cpp-python no está instalado o no cargó."
    elif not os.path.exists(estado.modelo):
        estado.error = f"No encuentro el modelo: {estado.modelo}"
    else:
        print("\n--- Cargando el cerebro de Ember en la RAM... ---")
        print(f"    modelo:  {estado.modelo}")
        print(f"    ctx:     {N_CTX}   hilos: {N_THREADS}   batch: {N_BATCH}")
        t0 = time.time()
        try:
            estado.llm = Llama(
                model_path=estado.modelo,
                n_ctx=N_CTX,
                n_threads=N_THREADS,
                n_batch=N_BATCH,
                verbose=False,
            )
            print(f"--- Cerebro listo en {time.time() - t0:.1f}s ---\n")
        except Exception as exc:
            estado.error = f"Error cargando el modelo: {exc}"
            print(f"--- {estado.error} ---\n")
    yield
    estado.llm = None


app = FastAPI(title="Ember IA", version="0.4", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------------------
# Prompts
# ----------------------------------------------------------------------------

SYSTEM_BASE = (
    "Eres Ember, un asistente de programación que corre dentro de un teléfono "
    "Android, sin internet. Responde en el idioma del usuario, con código "
    "correcto y completo dentro de bloques ```lenguaje. Explica solo lo "
    "necesario. Si no sabes algo, dilo; no inventes funciones ni APIs."
)

MODO_PROMPTS = {
    "general": "Modo asistente general: resuelve dudas, explica y da ejemplos.",
    "flamecode": "Modo flamecode: responde casi solo con código limpio y comentado.",
    "flamedash": (
        "Modo flamedash: trabajas con el DSL del usuario. Usa bloques con "
        "area=, Ripetox=, activision~Zeit=, actionscript~Zeit=, actende~Zeit=."
    ),
    "flameformel": "Modo flameformel: muestra fórmulas, pasos de cálculo y resultado.",
    "sitmob": "Modo SitMoB: respuestas cortas y seguras, sin comandos destructivos.",
}


def memoria_para_prompt(limite: int = 6) -> str:
    notas = leer_toda_la_memoria()[:limite]
    if not notas:
        return ""
    lineas = [f"- {n.get('tema', '?')}: {str(n.get('dato', ''))[:160]}" for n in notas]
    return "\n\nDatos que el usuario te ha enseñado:\n" + "\n".join(lineas)


class Mensaje(BaseModel):
    role: str
    content: str


class Pregunta(BaseModel):
    mensaje: str
    historial: List[Mensaje] = []
    modo: str = "general"
    nivel_razonamiento: str = "bajo"


def construir_mensajes(p: Pregunta) -> list:
    sistema = SYSTEM_BASE + " " + MODO_PROMPTS.get(p.modo, MODO_PROMPTS["general"])
    sistema += memoria_para_prompt()

    mensajes = [{"role": "system", "content": sistema}]
    for m in p.historial[-MAX_HISTORIAL:]:
        if m.role in ("user", "assistant") and m.content.strip():
            mensajes.append({"role": m.role, "content": m.content[:4000]})
    mensajes.append({"role": "user", "content": p.mensaje})
    return mensajes


def _parametros(p: Pregunta):
    return (
        MAX_TOKENS.get(p.nivel_razonamiento, 512),
        PASADAS.get(p.nivel_razonamiento, 1),
    )


def _comprobar_modelo():
    if estado.llm is None:
        raise HTTPException(503, estado.error or "El modelo no está cargado.")


# ----------------------------------------------------------------------------
# API
# ----------------------------------------------------------------------------


@app.get("/api/estado")
def api_estado():
    return {
        "ok": estado.llm is not None,
        "modelo": Path(estado.modelo).name,
        "error": estado.error,
        "ctx": N_CTX,
        "threads": N_THREADS,
        "memoria": len(leer_toda_la_memoria()),
        "version": "0.4",
    }


@app.post("/api/chat")
def api_chat(p: Pregunta):
    _comprobar_modelo()
    if not p.mensaje.strip():
        raise HTTPException(400, "Mensaje vacío.")

    max_tokens, pasadas = _parametros(p)
    mensajes = construir_mensajes(p)
    t0 = time.time()
    texto = ""

    with estado.lock:
        for i in range(pasadas):
            salida = estado.llm.create_chat_completion(
                messages=mensajes,
                max_tokens=max_tokens,
                temperature=0.3,
                top_p=0.9,
                repeat_penalty=1.1,
            )
            texto = salida["choices"][0]["message"]["content"].strip()
            if i + 1 < pasadas:
                mensajes = mensajes + [
                    {"role": "assistant", "content": texto},
                    {
                        "role": "user",
                        "content": (
                            "Revisa tu respuesta anterior, corrige errores y "
                            "devuelve solo la versión final."
                        ),
                    },
                ]

    return {
        "respuesta": texto,
        "modelo": Path(estado.modelo).name,
        "pasadas": pasadas,
        "ms": int((time.time() - t0) * 1000),
    }


def _sse(obj: dict) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


@app.post("/api/chat/stream")
def api_chat_stream(p: Pregunta):
    _comprobar_modelo()
    if not p.mensaje.strip():
        raise HTTPException(400, "Mensaje vacío.")

    max_tokens, _ = _parametros(p)
    mensajes = construir_mensajes(p)

    def generador():
        try:
            with estado.lock:
                for trozo in estado.llm.create_chat_completion(
                    messages=mensajes,
                    max_tokens=max_tokens,
                    temperature=0.3,
                    top_p=0.9,
                    repeat_penalty=1.1,
                    stream=True,
                ):
                    try:
                        delta = trozo["choices"][0]["delta"].get("content") or ""
                    except (KeyError, IndexError):
                        delta = ""
                    if delta:
                        yield _sse({"delta": delta})
            yield _sse({"done": True})
        except GeneratorExit:
            raise
        except Exception as exc:  # noqa: BLE001
            yield _sse({"error": str(exc)})

    return StreamingResponse(
        generador(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ----------------------------- memoria -------------------------------------


class Dato(BaseModel):
    tema: str
    dato: str
    persona: str = "Alexi"
    tipo: str = "privada"


@app.get("/api/memoria")
def api_memoria():
    return {"items": leer_toda_la_memoria()}


@app.post("/api/memoria")
def api_guardar(d: Dato):
    try:
        item = guardar_dato(d.tema, d.dato, d.persona, d.tipo)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"ok": True, "item": item}


@app.delete("/api/memoria/{item_id}")
def api_borrar(item_id: str):
    if not borrar_dato(item_id):
        raise HTTPException(404, "No encontrado.")
    return {"ok": True}


# ----------------------------- explorar web --------------------------------


class Explorar(BaseModel):
    urls: List[str]
    tipo: str = "publica"


def _resumir_url(url: str) -> dict:
    resp = requests.get(
        url,
        timeout=8,
        headers={"User-Agent": "Mozilla/5.0 (Ember; Android)"},
    )
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text[:400_000], "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        tag.decompose()

    titulo = url
    if soup.title and soup.title.string:
        titulo = soup.title.string.strip()

    texto = " ".join(soup.get_text(" ").split())
    return {"url": url, "titulo": titulo[:120], "resumen": texto[:600]}


@app.post("/api/explorar")
def api_explorar(p: Explorar):
    resultados = []
    tipo = p.tipo if p.tipo in MEMORIA_DIRS else "publica"

    for url in p.urls[:5]:
        if urlparse(url).scheme not in ("http", "https"):
            continue
        try:
            item = _resumir_url(url)
            nota = guardar_dato(
                item["titulo"],
                f"{item['resumen']} (fuente: {url})",
                "Ember-Web",
                tipo,
            )
            item["id"] = nota["id"]
        except Exception as exc:  # noqa: BLE001
            item = {"url": url, "titulo": url, "resumen": f"No se pudo leer: {exc}"}
        resultados.append(item)

    return {"resultados": resultados}


# ----------------------------------------------------------------------------
# Web estática: solo los archivos de la lista blanca
# ----------------------------------------------------------------------------


@app.get("/")
def index():
    ruta = BASE_DIR / "index.html"
    if not ruta.exists():
        raise HTTPException(404, "Falta index.html junto a main.py")
    return FileResponse(ruta, media_type="text/html; charset=utf-8")


@app.get("/{archivo}")
def archivo_web(archivo: str):
    if archivo not in ARCHIVOS_WEB:
        raise HTTPException(404, "No encontrado")
    ruta = BASE_DIR / archivo
    if not ruta.exists():
        raise HTTPException(404, f"Falta {archivo}")
    return FileResponse(ruta, media_type=ARCHIVOS_WEB[archivo])


if __name__ == "__main__":
    import uvicorn

    print(f"\nEmber en http://127.0.0.1:{PORT}\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
