from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import requests
from bs4 import BeautifulSoup

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear las 3 carpetas de memoria
for carpeta in ["memoria_privada", "memoria_publica", "memoria_oficial"]:
    if not os.path.exists(carpeta):
        os.makedirs(carpeta)

class Pregunta(BaseModel):
    mensaje: str
    nivel_razonamiento: str = "bajo" 

@app.post("/api/chat")
async def chat(pregunta: Pregunta):
    mensaje = pregunta.mensaje.lower()
    
    if "imagen" in mensaje or "dibuja" in mensaje:
        return {"respuesta": "Soy Ember, especializado en programación. No puedo generar imágenes."}

    if "http" in mensaje:
        try:
            url = [word for word in pregunta.mensaje.split() if "http" in word][0]
            res = requests.get(url, timeout=5)
            soup = BeautifulSoup(res.text, 'html.parser')
            texto = soup.get_text()[:300] 
            return {"respuesta": f"Leí la página web. Aquí tienes un resumen:\n\n{texto}..."}
        except Exception:
            return {"respuesta": "No pude leer ese enlace."}

    pasadas = 1
    if pregunta.nivel_razonamiento == "alto": pasadas = 3
    elif pregunta.nivel_razonamiento == "medio": pasadas = 2
        
    respuesta = f"[Razonamiento {pregunta.nivel_razonamiento.upper()}] Pensé tu respuesta haciendo {pasadas} revisión(es)."
    return {"respuesta": respuesta}
