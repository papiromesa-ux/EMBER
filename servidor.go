package main

import (
"encoding/json"
"fmt"
"io"
"net/http"
"os"
"regexp"
"strings"
"time"
)

const memFile = "ember_memoria.json"

type DatoAprendido struct {
Tema    string `json:"tema"`
Dato    string `json:"dato"`
Persona string `json:"persona"`
Fecha   string `json:"fecha"`
}

type MemoriaEmber struct {
Conocimientos []DatoAprendido `json:"conocimientos"`
}

type ChatReq struct {
Mensaje string `json:"mensaje"`
Modo    string `json:"modo"`
}

type ExplorarReq struct {
Urls []string `json:"urls"`
}

type ResultadoUrl struct {
Url     string `json:"url"`
Titulo  string `json:"titulo"`
Resumen string `json:"resumen"`
}

func cargarMemoria() MemoriaEmber {
var m MemoriaEmber
data, err := os.ReadFile(memFile)
if err != nil {
return m
}
_ = json.Unmarshal(data, &m)
return m
}

func guardarMemoria(m MemoriaEmber) {
data, err := json.MarshalIndent(m, "", "  ")
if err == nil {
_ = os.WriteFile(memFile, data, 0644)
}
}

func agregarDato(tema, dato, persona string) {
m := cargarMemoria()
for i, item := range m.Conocimientos {
if strings.EqualFold(item.Tema, tema) {
m.Conocimientos[i] = DatoAprendido{Tema: tema, Dato: dato, Persona: persona, Fecha: time.Now().Format(time.RFC3339)}
guardarMemoria(m)
return
}
}
m.Conocimientos = append(m.Conocimientos, DatoAprendido{
Tema:    tema,
Dato:    dato,
Persona: persona,
Fecha:   time.Now().Format(time.RFC3339),
})
guardarMemoria(m)
}

func limpiarHTML(raw string) (string, string) {
reTitle := regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
titulo := ""
if match := reTitle.FindStringSubmatch(raw); len(match) > 1 {
titulo = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(match[1], " "))
}

reScript := regexp.MustCompile(`(?is)<(script|style|noscript)[^>]*>.*?</(script|style|noscript)>`)
sinScripts := reScript.ReplaceAllString(raw, " ")
reTags := regexp.MustCompile(`(?s)<[^>]+>`)
texto := reTags.ReplaceAllString(sinScripts, " ")
texto = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(texto, " "))

if len(texto) > 420 {
texto = texto[:420] + "..."
}
return titulo, texto
}

func leerSitio(url string) ResultadoUrl {
client := &http.Client{Timeout: 10 * time.Second}
req, err := http.NewRequest("GET", url, nil)
if err != nil {
return ResultadoUrl{Url: url, Titulo: url, Resumen: "URL inválida."}
}
req.Header.Set("User-Agent", "EmberIA-Explorer/1.0")

resp, err := client.Do(req)
if err != nil {
return ResultadoUrl{Url: url, Titulo: url, Resumen: "No se pudo conectar: " + err.Error()}
}
defer resp.Body.Close()

body, err := io.ReadAll(io.LimitReader(resp.Body, 250000))
if err != nil {
return ResultadoUrl{Url: url, Titulo: url, Resumen: "Error leyendo contenido."}
}

titulo, resumen := limpiarHTML(string(body))
if titulo == "" {
titulo = url
}
if resumen == "" {
resumen = "Página sin texto legible directo (puede requerir renderizado JS)."
}
agregarDato(titulo, resumen, "Ember-Explorer")
return ResultadoUrl{Url: url, Titulo: titulo, Resumen: resumen}
}

func cors(w http.ResponseWriter) {
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
w.Header().Set("Content-Type", "application/json; charset=utf-8")
}

func main() {
http.HandleFunc("/api/explorar", func(w http.ResponseWriter, r *http.Request) {
cors(w)
if r.Method == "OPTIONS" {
return
}
var req ExplorarReq
_ = json.NewDecoder(r.Body).Decode(&req)
var resultados []ResultadoUrl
for _, u := range req.Urls {
u = strings.TrimSpace(u)
if u != "" {
resultados = append(resultados, leerSitio(u))
}
}
_ = json.NewEncoder(w).Encode(map[string]any{"resultados": resultados})
})

http.HandleFunc("/api/chat", func(w http.ResponseWriter, r *http.Request) {
cors(w)
if r.Method == "OPTIONS" {
return
}
var req ChatReq
_ = json.NewDecoder(r.Body).Decode(&req)
q := strings.ToLower(strings.TrimSpace(req.Mensaje))

m := cargarMemoria()
for i := len(m.Conocimientos) - 1; i >= 0; i-- {
item := m.Conocimientos[i]
if strings.Contains(q, strings.ToLower(item.Tema)) || (len(q) > 3 && strings.Contains(strings.ToLower(item.Tema), q)) {
resp := fmt.Sprintf("[Memoria Go // %s] (%s): %s", item.Tema, item.Persona, item.Dato)
_ = json.NewEncoder(w).Encode(map[string]string{"respuesta": resp})
return
}
}
w.WriteHeader(http.StatusNotFound)
})

fmt.Println("🔥 Servidor Ember IA activo en http://127.0.0.1:8080")
_ = http.ListenAndServe(":8080", nil)
}
