package main

import (
"encoding/json"
"fmt"
"log"
"math"
"net/http"
"os"
"path/filepath"
"regexp"
"strconv"
"strings"
"sync"
"time"
"unicode"
)

type DatoAprendido struct {
Tema        string `json:"tema"`
Dato        string `json:"dato"`
AportadoPor string `json:"aportado_por"`
Fecha       string `json:"fecha"`
}

type MemoriaSpark struct {
Notas         []string        `json:"notas"`
Conocimientos []DatoAprendido `json:"conocimientos"`
Actualizado   string          `json:"actualizado"`
}

type ChatRequest struct {
Message string `json:"message"`
Mode    string `json:"mode"`
}

type ChatResponse struct {
Reply         string `json:"reply"`
ArtifactTitle string `json:"artifactTitle,omitempty"`
ArtifactCode  string `json:"artifactCode,omitempty"`
}

type TeachRequest struct {
Tema    string `json:"tema"`
Dato    string `json:"dato"`
Persona string `json:"persona"`
}

var (
memMu              sync.Mutex
palabrasClaveFlame = []string{
"raum", "modul", "schablone", "struktur", "aufbau", "abbau",
"vorab", "fest", "mutable", "rolle", "gib", "leihe", "leihe_mut",
"publico", "ergebnis", "gut", "fehler", "vielleicht", "algo", "nichts",
"revisa", "kiste", "roh", "zeiger", "haupt", "eingabe!", "liste",
"laos", "aus", "bis", "weiter", "abbruch", "ja", "aber",
"und", "oder", "nicht", "wahr", "falsch", "versuch", "fang",
"manifest!", "drucken!", "manifestation!", "manifiesto",
"activision", "actionscript", "actende", "area", "Ripetox",
"davay", "link", "linkcheck", "linkdrucken", "linkdriver",
"driver", "aniverzal", "manus", "kaszchenein", "Ray", "conn",
"mizushis", "Destroyer", "Dalf", "say", "Yagert", "Virecari", "Hakgest",
}
accionesDash = []string{"activision", "actionscript", "actende"}
)

func rutaMemoria() string {
home, err := os.UserHomeDir()
if err != nil {
return "spark_memoria.json"
}
return filepath.Join(home, ".spark_ia_memoria.json")
}

func cargarMemoria() MemoriaSpark {
mem := MemoriaSpark{
Notas:         []string{},
Conocimientos: []DatoAprendido{},
}
data, err := os.ReadFile(rutaMemoria())
if err != nil {
return mem
}
_ = json.Unmarshal(data, &mem)
if mem.Notas == nil {
mem.Notas = []string{}
}
if mem.Conocimientos == nil {
mem.Conocimientos = []DatoAprendido{}
}
return mem
}

func guardarMemoria(mem MemoriaSpark) error {
mem.Actualizado = time.Now().Format("2006-01-02 15:04:05")
data, err := json.MarshalIndent(mem, "", "  ")
if err != nil {
return err
}
return os.WriteFile(rutaMemoria(), data, 0644)
}

func distanciaLevenshtein(a, b string) int {
ra := []rune(strings.ToLower(a))
rb := []rune(strings.ToLower(b))
la := len(ra)
lb := len(rb)
dp := make([][]int, la+1)
for i := 0; i <= la; i++ {
dp[i] = make([]int, lb+1)
dp[i][0] = i
}
for j := 0; j <= lb; j++ {
dp[0][j] = j
}
for i := 1; i <= la; i++ {
for j := 1; j <= lb; j++ {
costo := 1
if ra[i-1] == rb[j-1] {
costo = 0
}
minVal := dp[i-1][j] + 1
if dp[i][j-1]+1 < minVal {
minVal = dp[i][j-1] + 1
}
if dp[i-1][j-1]+costo < minVal {
minVal = dp[i-1][j-1] + costo
}
dp[i][j] = minVal
}
}
return dp[la][lb]
}

func esZeitValido(val string) bool {
v := strings.ToLower(strings.TrimSpace(val))
if v == "inmediato" || v == "original" || v == "infinito" {
return true
}
return regexp.MustCompile("^[0-9]+([.][0-9]+)?[.](ms|s|m|h)$").MatchString(v)
}

func sugerirPalabraFlame(token string) string {
limpio := strings.Trim(token, "(),[]{}:;=<>\"'~")
if limpio == "" || strings.HasPrefix(limpio, "@") || strings.HasPrefix(limpio, "###") {
return ""
}
for _, kw := range palabrasClaveFlame {
if strings.EqualFold(limpio, kw) {
return ""
}
}
mejor := ""
mejorDist := 999
for _, kw := range palabrasClaveFlame {
d := distanciaLevenshtein(limpio, kw)
if d > 0 && d <= 2 && d < mejorDist {
mejorDist = d
mejor = kw
}
}
return mejor
}

func analizarFlame(contenido string) []string {
var avisos []string
lineas := strings.Split(contenido, "\n")
tieneStil := false
modo := ""
reTok := regexp.MustCompile("[A-Za-z_!]+")
comillas := 0

for i, linea := range lineas {
trim := strings.TrimSpace(linea)
if trim == "" || strings.HasPrefix(trim, "###") || strings.HasPrefix(trim, "<") || strings.HasPrefix(trim, "</") || strings.HasPrefix(trim, "$=") {
continue
}
comillas += strings.Count(trim, "\"")
toksLinea := reTok.FindAllString(trim, -1)

if strings.HasPrefix(trim, "!stil") {
tieneStil = true
partes := strings.Fields(trim)
if len(partes) < 2 {
avisos = append(avisos, fmt.Sprintf("Linea %d: falta modo tras !stil.", i+1))
} else {
modo = partes[len(partes)-1]
if modo != "flamecode" && modo != "flamedash" && modo != "flameformel" {
avisos = append(avisos, fmt.Sprintf("Linea %d: modo '%s' no reconocido.", i+1, modo))
}
}
}
if strings.Contains(trim, "~zeit=") {
idx := strings.Index(trim, "~zeit=")
campos := strings.Fields(trim[idx+6:])
if len(campos) == 0 || !esZeitValido(campos[0]) {
avisos = append(avisos, fmt.Sprintf("Linea %d: valor no valido en ~zeit.", i+1))
}
}
for _, tok := range toksLinea {
if sug := sugerirPalabraFlame(tok); sug != "" {
avisos = append(avisos, fmt.Sprintf("Linea %d: '%s' no coincide. Querias decir '%s'?", i+1, tok, sug))
}
}
}

if comillas%2 != 0 {
avisos = append(avisos, "Comillas: falta cerrar alguna comilla doble.")
}
if a, c := strings.Count(contenido, "["), strings.Count(contenido, "]"); a != c {
avisos = append(avisos, fmt.Sprintf("Corchetes: %d '[' y %d ']'.", a, c))
}
if a, c := strings.Count(contenido, "("), strings.Count(contenido, ")"); a != c {
avisos = append(avisos, fmt.Sprintf("Parentesis: %d '(' y %d ')'.", a, c))
}
if a, c := strings.Count(contenido, "{"), strings.Count(contenido, "}"); a != c {
avisos = append(avisos, fmt.Sprintf("Llaves: %d '{' y %d '}'.", a, c))
}
if !tieneStil {
avisos = append(avisos, "Sugerencia: inicia con '!stil flamecode', '!stil flamedash' o '!stil flameformel'.")
}
return avisos
}

func auditarSeguridadSitMoB(contenido string) string {
bajo := strings.ToLower(contenido)
sospechosos := []string{"eval(", "exec(", "os.system", "rm -rf", "chmod 777", "payload", "exploit"}
var hallazgos []string
for _, item := range sospechosos {
if strings.Contains(bajo, item) {
hallazgos = append(hallazgos, item)
}
}
if len(hallazgos) == 0 {
return "SitMoB OK: No se detectaron patrones sensibles obvios."
}
return "SitMoB ALERTA: Patrones detectados -> " + strings.Join(hallazgos, ", ")
}

func fmtNum(v float64) string {
if math.Abs(v-math.Round(v)) < 1e-9 && math.Abs(v) < 1e15 {
return fmt.Sprintf("%d", int64(math.Round(v)))
}
return strconv.FormatFloat(v, 'f', -1, 64)
}

type parser struct {
s   string
pos int
}

func (p *parser) sp() {
for p.pos < len(p.s) && unicode.IsSpace(rune(p.s[p.pos])) {
p.pos++
}
}

func (p *parser) expr() (float64, error) {
v, err := p.term()
if err != nil {
return 0, err
}
for {
p.sp()
if p.pos >= len(p.s) || (p.s[p.pos] != '+' && p.s[p.pos] != '-') {
break
}
op := p.s[p.pos]
p.pos++
r, err := p.term()
if err != nil {
return 0, err
}
if op == '+' {
v += r
} else {
v -= r
}
}
return v, nil
}

func (p *parser) term() (float64, error) {
v, err := p.pow()
if err != nil {
return 0, err
}
for {
p.sp()
if p.pos >= len(p.s) || (p.s[p.pos] != '*' && p.s[p.pos] != '/' && p.s[p.pos] != '%') {
break
}
op := p.s[p.pos]
p.pos++
r, err := p.pow()
if err != nil {
return 0, err
}
switch op {
case '*':
v *= r
case '/':
if r == 0 {
return 0, fmt.Errorf("No se puede dividir entre cero.")
}
v /= r
case '%':
if r == 0 {
return 0, fmt.Errorf("No se puede calcular modulo entre cero.")
}
v = math.Mod(v, r)
}
}
return v, nil
}

func (p *parser) pow() (float64, error) {
p.sp()
if p.pos < len(p.s) && (p.s[p.pos] == '+' || p.s[p.pos] == '-') {
sign := 1.0
if p.s[p.pos] == '-' {
sign = -1.0
}
p.pos++
v, err := p.pow()
return sign * v, err
}
b, err := p.prim()
if err != nil {
return 0, err
}
p.sp()
if p.pos < len(p.s) && p.s[p.pos] == '^' {
p.pos++
e, err := p.pow()
if err != nil {
return 0, err
}
return math.Pow(b, e), nil
}
return b, nil
}

func (p *parser) prim() (float64, error) {
p.sp()
if p.pos < len(p.s) && p.s[p.pos] == '(' {
p.pos++
v, err := p.expr()
if err != nil {
return 0, err
}
p.sp()
if p.pos < len(p.s) && p.s[p.pos] == ')' {
p.pos++
}
return v, nil
}
start := p.pos
dot := false
dig := false
for p.pos < len(p.s) {
c := p.s[p.pos]
if c >= '0' && c <= '9' {
dig = true
p.pos++
} else if c == '.' && !dot {
dot = true
p.pos++
} else {
break
}
}
if !dig {
return 0, fmt.Errorf("invalido")
}
return strconv.ParseFloat(p.s[start:p.pos], 64)
}

func aMs(v float64, u string) (float64, bool) {
switch strings.ToLower(u) {
case "ms":
return v, true
case "s":
return v * 1000, true
case "m":
return v * 60000, true
case "h":
return v * 3600000, true
}
return 0, false
}

func deMs(ms float64, u string) (string, bool) {
switch strings.ToLower(u) {
case "ms":
return fmtNum(ms) + ".ms", true
case "s":
return fmtNum(ms/1000) + ".s", true
case "m":
return fmtNum(ms/60000) + ".m", true
case "h":
return fmtNum(ms/3600000) + ".h", true
}
return "", false
}
func resolverMate(texto string) (string, bool) {
reRip := regexp.MustCompile("(?i)([0-9]+([.][0-9]+)?)[.](ms|s|m|h)[^0-9]+(ripetox|repeticiones|veces)[ ]*=?[ ]*([0-9]+)")
m := reRip.FindStringSubmatch(texto)
if len(m) == 6 {
d, _ := strconv.ParseFloat(m[1], 64)
r, _ := strconv.ParseFloat(m[5], 64)
unit := strings.ToLower(m[3])
res := fmtNum(d*r) + "." + unit
if ms, ok := aMs(d*r, unit); ok {
reConv := regexp.MustCompile("(?i) en [.]?(ms|s|m|h)")
conv := reConv.FindStringSubmatch(texto)
if len(conv) == 2 {
if out, ok2 := deMs(ms, conv[1]); ok2 {
return res + " (" + out + ")", true
}
}
}
return res, true
}
limpio := strings.ReplaceAll(strings.ReplaceAll(texto, "×", "*"), "**", "^")
expr := regexp.MustCompile("(?:-?[0-9]+([.][0-9]+)?|[(])[0-9 +*/%^().-]*[0-9)]").FindString(limpio)
if expr == "" || !strings.ContainsAny(expr, "+-*/%^") {
return "", false
}
val, err := (&parser{s: expr}).expr()
if err != nil {
if strings.Contains(err.Error(), "cero") {
return err.Error(), true
}
return "", false
}
return fmtNum(val), true
}

func glosarioTema(tema string) (string, bool) {
t := strings.ToLower(strings.TrimSpace(tema))
switch t {
case "zeit", "~zeit":
return "~zeit: modificador de tiempo (inmediato, original, infinito o .ms, .s, .m, .h).", true
case "area":
return "area: define espacio o longitud, por ejemplo area= 512x400.", true
case "ripetox":
return "Ripetox: indica la cantidad de repeticiones, por ejemplo Ripetox=4.", true
case "activision":
return "activision: fase de activacion dentro de flamedash.", true
case "actionscript":
return "actionscript: fase de ejecucion de accion dentro de flamedash.", true
case "actende":
return "actende: fase de cierre o fin de accion dentro de flamedash.", true
case "manifest":
return "manifest!: salida estandar en flamecode.", true
case "eingabe":
return "eingabe!: entrada de datos del usuario en flamecode.", true
default:
return "", false
}
}

func plantillaModo(modo string) (string, string) {
if modo == "flamecode" {
return "principal.fm", "!stil flamecode\n<flamecode>\nmanifest! = \"Iniciando sistema FLAME\":\n@usuario = eingabe! = \"Ingresa tu nombre:\":\nmanifest! = \"Hola \" H @usuario:\n</flamecode>\n"
}
if modo == "flameformel" {
return "formula.fm", "!stil flameformel\nmanifiesto=javascript\n<flameformel>\n <javascript>\n  <archiv>\"modulo.js\">\n   [Inhalt=vollstaendig]\n   [aktion=komprimieren]\n   [linkname=\"nucleo\"]\n  </archiv>\n </javascript>\n</flameformel>\n"
}
return "flamedash.fm", "!stil flamedash\nmanifiesto=javascript\n<flamedash>\n <javascript>\n  [dash=panelbase\n   activision~zeit=inmediato\n   actionscript~zeit=1.s\n   actende~zeit=original]\n </javascript>\n</flamedash>\n"
}

func enableCORS(w http.ResponseWriter) {
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func handleChat(w http.ResponseWriter, r *http.Request) {
enableCORS(w)
if r.Method == http.MethodOptions {
w.WriteHeader(http.StatusOK)
return
}
if r.Method != http.MethodPost {
http.Error(w, "Metodo no permitido", http.StatusMethodNotAllowed)
return
}

var req ChatRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "JSON invalido", http.StatusBadRequest)
return
}

msg := strings.TrimSpace(req.Message)
lower := strings.ToLower(msg)
mode := req.Mode
if mode == "" {
mode = "general"
}

memMu.Lock()
mem := cargarMemoria()
memMu.Unlock()

var resp ChatResponse

if mode == "sitmob" || strings.HasPrefix(lower, "auditar:") {
codigo := strings.TrimSpace(strings.TrimPrefix(msg, "auditar:"))
resp.Reply = auditarSeguridadSitMoB(codigo)
if strings.Contains(codigo, "\n") {
resp.ArtifactTitle = "auditoria.fm"
resp.ArtifactCode = codigo
}
writeJSON(w, resp)
return
}

if strings.Contains(msg, "!stil") || strings.Contains(msg, "<flame") {
avisos := analizarFlame(msg)
seg := auditarSeguridadSitMoB(msg)
if len(avisos) == 0 {
resp.Reply = "Spark.IA: Codigo FLAME valido y sin errores detectados.\n" + seg
} else {
resp.Reply = "Spark.IA encontro lo siguiente:\n - " + strings.Join(avisos, "\n - ") + "\n\n" + seg
}
resp.ArtifactTitle = "analisis.fm"
resp.ArtifactCode = msg
writeJSON(w, resp)
return
}

if strings.Contains(lower, "plantilla") || strings.Contains(lower, "estructura de un bloque") {
targetMode := mode
if strings.Contains(lower, "flamecode") {
targetMode = "flamecode"
} else if strings.Contains(lower, "flameformel") {
targetMode = "flameformel"
} else if strings.Contains(lower, "flamedash") || targetMode == "general" {
targetMode = "flamedash"
}
title, code := plantillaModo(targetMode)
resp.Reply = fmt.Sprintf("He generado la plantilla oficial '%s' de FLAME en el panel lateral.", targetMode)
resp.ArtifactTitle = title
resp.ArtifactCode = code
writeJSON(w, resp)
return
}

if calc, ok := resolverMate(msg); ok {
resp.Reply = "!Spark = " + calc
writeJSON(w, resp)
return
}

for i := len(mem.Conocimientos) - 1; i >= 0; i-- {
c := mem.Conocimientos[i]
if strings.Contains(lower, strings.ToLower(c.Tema)) {
resp.Reply = fmt.Sprintf("[SPARK-MEMORIA // TEMA: %s]\nSpark: Me acuerdo de esto — me lo compartio %s (%s).\nFormato Spark: %s", c.Tema, c.AportadoPor, c.Fecha, c.Dato)
writeJSON(w, resp)
return
}
}

for _, k := range []string{"zeit", "area", "ripetox", "activision", "actionscript", "actende", "manifest", "eingabe"} {
if strings.Contains(lower, k) {
if g, ok := glosarioTema(k); ok {
resp.Reply = "!Spark = " + g
writeJSON(w, resp)
return
}
}
}

resp.Reply = fmt.Sprintf("[Spark.IA Go // Modo: %s] Nucleo activo. Conocimientos en memoria compartida: %d.", mode, len(mem.Conocimientos))
writeJSON(w, resp)
}

func handleTeach(w http.ResponseWriter, r *http.Request) {
enableCORS(w)
if r.Method == http.MethodOptions {
w.WriteHeader(http.StatusOK)
return
}
if r.Method != http.MethodPost {
http.Error(w, "Metodo no permitido", http.StatusMethodNotAllowed)
return
}
var req TeachRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "JSON invalido", http.StatusBadRequest)
return
}
tema := strings.TrimSpace(req.Tema)
dato := strings.TrimSpace(req.Dato)
persona := strings.TrimSpace(req.Persona)
if tema == "" || dato == "" {
http.Error(w, "Campos incompletos", http.StatusBadRequest)
return
}
if persona == "" {
persona = "Alexi"
}

memMu.Lock()
mem := cargarMemoria()
mem.Conocimientos = append(mem.Conocimientos, DatoAprendido{
Tema:        tema,
Dato:        dato,
AportadoPor: persona,
Fecha:       time.Now().Format(time.RFC3339),
})
_ = guardarMemoria(mem)
memMu.Unlock()

writeJSON(w, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, data interface{}) {
w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(data)
}

func main() {
fs := http.FileServer(http.Dir("."))
http.Handle("/", fs)
http.HandleFunc("/api/chat", handleChat)
http.HandleFunc("/api/teach", handleTeach)

port := os.Getenv("PORT")
if port == "" {
port = "8080"
}
fmt.Println("SPARK.IA Go Engine activo en http://localhost:" + port)
log.Fatal(http.ListenAndServe(":"+port, nil))
}
