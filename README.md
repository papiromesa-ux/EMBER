# Ember IA v0.4

Asistente de programación que corre **dentro de tu teléfono Android**, sin nube.
El modelo (GGUF) vive en el móvil, el servidor es FastAPI, y la web se sirve
desde el propio teléfono.

```
EMBER/
├── main.py                  servidor FastAPI + llama.cpp
├── requirements.txt
├── run.sh                   arranque para Termux
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── icon.svg
├── memoria_privada/         (se crea solo)
├── memoria_publica/         (se crea solo)
├── memoria_oficial/         (se crea solo)
├── .backup-v0.3/            copia de los archivos anteriores
└── qwen1_5-1_8b-chat-q4_k_m.gguf   ← tu modelo, va aquí
```

---

## 1. Requisitos

- Android con **6–8 GB de RAM** (en este teléfono el sistema reporta ~3.7 GB
  totales y ~1 GB libre: el modelo entra, pero justo; cierra otras apps antes
  de arrancar y usa `EMBER_CTX=1024`).
- **Termux** (de F-Droid, no de Play Store).
- Un modelo `.gguf` cuantizado **Q4_K_M** de ~1.1 GB.

Modelo que ya tienes:

```
qwen1_5-1_8b-chat-q4_k_m.gguf
```

> **Recomendación:** para código, `Qwen2.5-Coder-1.5B-Instruct` en `Q4_K_M`
> (~1.1 GB) es notablemente mejor que Qwen 1.5 1.8B. Solo cambias el archivo y
> la variable `EMBER_MODEL`; nada más.

---

## 2. Instalación en Termux

```bash
pkg update && pkg upgrade -y
pkg install python clang cmake make git -y

# llama-cpp-python compilado para tu CPU (tarda bastante la primera vez)
CMAKE_ARGS="-DLLAMA_NATIVE=ON" pip install llama-cpp-python

pip install fastapi uvicorn requests beautifulsoup4
```

Copia la carpeta `EMBER/` al teléfono (por ejemplo a `~/EMBER`) y coloca el
`.gguf` dentro.

```bash
cd ~/ember
chmod +x run.sh
```

---

## 3. Arrancar

```bash
./run.sh
```

o directamente:

```bash
python main.py
```

Cuando veas:

```
--- Cerebro listo en XX.Xs ---
Ember en http://127.0.0.1:8000
```

abre en el navegador del teléfono:

```
http://127.0.0.1:8000
```

### Desde la computadora (misma WiFi)

```bash
ifconfig | grep "inet "      # apunta la IP, ej. 192.168.1.42
```

y abre `http://192.168.1.42:8000`.

### Que Android no lo mate

- Ajustes → Apps → Termux → Batería → **Sin restricciones**.
- Deja Termux abierto o usa `termux-wake-lock` (lo hace `run.sh`).

---

## 4. Variables de entorno

| Variable | Defecto | Para qué |
|---|---|---|
| `EMBER_MODEL` | `qwen1_5-1_8b-chat-q4_k_m.gguf` | ruta del `.gguf` |
| `EMBER_CTX` | `2048` | contexto; súbelo a `3072` si tienes 8 GB |
| `EMBER_THREADS` | `4` | hilos de CPU |
| `EMBER_BATCH` | `256` | bájalo a `128` si se queda sin RAM |
| `EMBER_PORT` | `8000` | puerto |

Ejemplo:

```bash
EMBER_CTX=3072 EMBER_THREADS=6 ./run.sh
```

---

## 5. API

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/estado` | modelo cargado, ctx, nº de notas |
| `POST` | `/api/chat` | respuesta completa |
| `POST` | `/api/chat/stream` | respuesta en streaming (SSE) |
| `GET` | `/api/memoria` | todas las notas |
| `POST` | `/api/memoria` | guardar/actualizar una nota |
| `DELETE` | `/api/memoria/{id}` | borrar una nota |
| `POST` | `/api/explorar` | leer URLs, resumirlas y guardarlas |

Ejemplo:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mensaje":"Hola, ¿quién eres?","modo":"general"}'
```

Cuerpo de `/api/chat`:

```json
{
  "mensaje": "texto",
  "historial": [{"role": "user", "content": "..."}],
  "modo": "general | flamecode | flamedash | flameformel | sitmob",
  "nivel_razonamiento": "bajo | medio | alto"
}
```

---

## 6. Publicarla en internet (opcional)

Si algún día quieres abrirla fuera de tu WiFi **sin subir el modelo a ninguna
nube**:

```bash
pkg install cloudflared
cloudflared tunnel --url http://127.0.0.1:8000
```

Te da una URL `https://algo.trycloudflare.com`. Esa URL apunta a tu teléfono:
el modelo sigue estando solo en el móvil, pero **el túnel queda público**
(cualquiera con el enlace puede usarlo) y se cae cuando apagas el teléfono.

Para la web de GitHub Pages, ábrela con la URL del túnel:

```
https://papiromesa-ux.github.io/EMBER/?api=https://algo.trycloudflare.com
```

Eso queda guardado en el navegador. También puedes fijarla en
**Comandos → Configurar URL del servidor**.

> Si no pones `?api=` ni configuras la URL, la web de GitHub Pages no puede
> llegar al teléfono (son orígenes distintos) y verás el aviso rojo de
> "Sin conexión". Es normal.

---

## 7. Qué cambió respecto a la v0.3

**Seguridad**
- La web se sirve con una lista blanca de archivos. Antes se montaba `.` y cualquiera en la
  red podía descargar el `.gguf` y leer `main.py`.
- Se limitan a 5 las URLs por petición en `/api/explorar`.

**Rendimiento**
- `n_ctx` 1024 → 2048 (configurable).
- `n_threads` 2 → 4 (configurable).
- `max_tokens` 512 → 512/768/1024 según nivel.
- El chat ya no bloquea el event loop: los endpoints son síncronos y corren en
  el threadpool de FastAPI.
- Un `Lock` evita que dos generaciones usen el modelo a la vez (llama.cpp no es
  thread-safe).

**Funcionalidad**
- Streaming token a token (SSE) con botón **Detener**.
- Historial de conversación (últimos 8 mensajes).
- Memoria real en disco: `memoria_privada/`, `memoria_publica/`,
  `memoria_oficial/`, con borrado desde la interfaz.
- `/api/explorar` implementado: lee enlaces, resume y guarda.
- Los modos ahora cambian el *system prompt*, no solo la etiqueta.
- Panel de código con botones **Copiar** y **Panel** en cada bloque.
- Aviso claro de conexión: si el servidor no responde, se dice; ya no se
  inventan respuestas.
- PWA: se puede "Añadir a pantalla de inicio".

**Correcciones**
- Se eliminó `replySmart()`, que simulaba respuestas de IA cuando fallaba el
  backend.
- Se eliminó el "corrector" que cambiaba `seit` → `Zeit` (en alemán `seit`
  significa "desde", así que estaba mal).
- `tryExploreUrls()` ahora sí se usa.

---

## 8. Problemas comunes

**"No encuentro el modelo"**
El `.gguf` no está junto a `main.py` o el nombre no coincide. Revisa:

```bash
ls -lh *.gguf
EMBER_MODEL=tu_archivo.gguf python main.py
```

**"llama-cpp-python no disponible"**
Falta compilarlo:

```bash
pip install --upgrade --force-reinstall llama-cpp-python
```

**Se cierra por falta de memoria**
Baja `EMBER_CTX=1024` y `EMBER_BATCH=64`. Cierra el resto de apps. Si aún así
muere al cargar, el teléfono no tiene RAM suficiente para 1.8B: usa un modelo
0.5B (por ejemplo `Qwen2.5-Coder-0.5B-Instruct` Q4, ~400 MB).

**Va lentísimo**
- Usa un modelo más pequeño (1.5B Q4).
- Cierra otras apps.
- `EMBER_THREADS` = número de núcleos grandes (normalmente 4).

**La web carga pero no responde**
Mira la terminal: si dice "Servidor sin modelo", el error exacto está ahí.

---

## 9. Límites honestos

Un modelo de 1.5B–1.8B en un teléfono **no** es comparable a un asistente grande.
Sirve para: autocompletar, explicar fragmentos, generar funciones cortas,
corregir errores simples y responder dudas concretas. Para arquitectura de
proyectos grandes o razonamiento profundo se queda corto, y a veces inventará
APIs. El system prompt le pide no hacerlo, pero no es garantía.
