package main

import (
"encoding/json"
"fmt"
"io"
"net/http"
"os"
"path/filepath"
"regexp"
"strings"
"time"
)

const memDir = "memoria"

type DatoAprendido struct {
Tema    string `json:"tema"`
Dato    string `json:"dato"`
Persona string `json:"persona"`
Fecha   string `json:"fecha"`
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

func slugArchivo(tema string) string {
s := strings.ToLower(strings.TrimSpace(tema))
re := regexp.MustCompile(`[^a-z0-9]+`)
s = strings.Trim(re.ReplaceAllString(s, "_"), "_")
if s == "" {
s = "nota"
}
if len(s) > 40 {
s = s[:40]
}
return filepath.Join(memDir, s+".json")
}

func cargarTodosLosDatos() []DatoAprendido {
_ = os.MkdirAll(memDir, 0755)
archivos, err := filepath.Glob(filepath.Join(memDir, "*.json"))
if err != nil {
return nil
}
var lista []DatoAprendido
for _, f := range archivos {
raw, err := os.ReadFile(f)
if err != nil {
continue
}
var item DatoAprendido
if json.Unmarshal(raw, &item) == nil && strings.TrimSpace(item.Dato) != "" {
lista = append(lista, item)
}
}
return lista
}

func guardarDatoEnCarpeta(tema, dato, persona string) {
_ = os.MkdirAll(memDir, 0755)
item := DatoAprendido{
Tema:    strings.TrimSpace(tema),
Dato:    strings.TrimSpace(dato),
Persona: persona,
Fecha:   time.Now().Format(time.RFC3339),
}
data, err := json.MarshalIndent(item, "", "  ")
if err == nil {
_ = os.WriteFile(slugArchivo(tema), data, 0644)
}
}

func pareceBloqueoOLogin(txt string) bool {
l := strings.ToLower(txt)
marcas := []string{
"sign in", "sign up", "log in", "iniciar sesion", "iniciar sesión",
"reload to refresh your session", "you signed in with another tab",
"access denied", "captcha", "verify you are human",
}
for _, m := range marcas {
if strings.Contains(l, m) {
return true
}
}
return false
}

func limpiarTextoHTML(raw string) (string, string) {
reTitle := regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
titulo := ""
if m := reTitle.FindStringSubmatch(raw); len(m) > 1 {
titulo = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(m[1], " "))
}

reBlock := regexp.MustCompile(`(?is)<(script|style|noscript|nav|header|footer)[^>]*>.*?</(script|style|noscript|nav|header|footer)>`)
limpio := reBlock.ReplaceAllString(raw, " ")
limpio = regexp.MustCompile(`(?s)<[^>]+>`).ReplaceAllString(limpio, " ")

limpio = strings.ReplaceAll(limpio, "&amp;", "&")
limpio = strings.ReplaceAll(limpio, "&quot;", "\"")
limpio = strings.ReplaceAll(limpio, "&#39;", "'")
limpio = strings.ReplaceAll(limpio, "&lt;", "<")
limpio = strings.ReplaceAll(limpio, "&gt;", ">")
limpio = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(limpio, " "))

if pareceBloqueoOLogin(limpio) {
return titulo, "El sitio requiere inicio de sesion o restringe el acceso automatico."
}
if len(limpio) > 360 {
limpio = limpio[:360] + "..."
}
return titulo, limpio
}

func leerSitioSeguro(url string) ResultadoUrl {
client := &http.Client{Timeout: 10 * time.Second}
req, err := http.NewRequest("GET", url, nil)
if err != nil {
return ResultadoUrl{Url: url, Titulo: url, Resumen: "URL no valida."}
}
req.Header.Set("User-Agent", "EmberIA-Explorer/1.0")

resp, err := client.Do(req)
if err != nil {
return ResultadoUrl{Url: url, Titulo: url, Resumen: "Sin conexion al sitio."}
}
defer resp.Body.Close()

body, err := io.ReadAll(io.LimitReader(resp.Body, 250000))
if err != nil {
return ResultadoUrl{Url: url, Titulo: url, Resumen: "Error leyendo cuerpo."}
}

titulo, resumen := limpiarTextoHTML(string(body))
if titulo == "" {
titulo = url
}
if resumen == "" {
resumen = "Sin texto plano legible."
}
guardarDatoEnCarpeta(titulo, resumen, "Ember-Explorer")
return ResultadoUrl{Url: url, Titulo: titulo, Resumen: resumen}
}

func palabrasClave(q string) []string {
stop := map[string]bool{
"que": true, "qué": true, "es": true, "el": true, "la": true, "los": true, "las": true,
"de": true, "del": true, "un": true, "una": true, "y": true, "en": true, "por": true,
"para": true, "was": true, "ist": true, "der": true, "die": true, "das": true, "und": true,
}
re := regexp.MustCompile(`[a-z0-9äöüß]+`)
tokens := re.FindAllString(strings.ToLower(q), -1)
var out []string
for _, t := range tokens {
if len(t) >= 3 && !stop[t] {
out = append(out, t)
}
}
return out
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
resultados = append(resultados, leerSitioSeguro(u))
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
keys := palabrasClave(req.Mensaje)
items := cargarTodosLosDatos()

mejorScore := 0
var mejor *DatoAprendido
for i := range items {
haystack := strings.ToLower(items[i].Tema + " " + items[i].Dato)
score := 0
for _, k := range keys {
if strings.Contains(haystack, k) {
score++
}
}
if score > mejorScore {
mejorScore = score
mejor = &items[i]
}
}

if mejor != nil && mejorScore > 0 {
resp := fmt.Sprintf("[Memoria // %s] %s", mejor.Tema, mejor.Dato)
_ = json.NewEncoder(w).Encode(map[string]string{"respuesta": resp})
return
}

w.WriteHeader(http.StatusNotFound)
})

fmt.Println("Ember IA activa en http://127.0.0.1:8080")
_ = http.ListenAndServe(":8080", nil)
}
