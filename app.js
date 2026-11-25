(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   *  Configuración
   * ------------------------------------------------------------------ */

  const LS_MEM = "ember_ia_memoria_v6";
  const LS_API = "ember_api_url";
  const LS_THEME = "ember_tema";

  const params = new URLSearchParams(location.search);
  let API_URL = (params.get("api") || localStorage.getItem(LS_API) || "").replace(/\/+$/, "");

  const state = {
    modo: "general",
    historial: [],
    memoria: [],
    enviando: false,
    ctrl: null,
  };

  const PLACEHOLDERS = {
    general: "Escribe tu pregunta, pega código o un enlace…",
    flamecode: "Pega el código y pide mejoras o correcciones…",
    flamedash: "Describe el bloque flamedash que quieres…",
    flameformel: "Escribe la fórmula o el cálculo…",
    sitmob: "Consulta corta y segura…",
  };

  const el = {
    sidebar: document.getElementById("sidebar"),
    btnOpenSidebar: document.getElementById("btnOpenSidebar"),
    btnCloseSidebar: document.getElementById("btnCloseSidebar"),
    btnNewChat: document.getElementById("btnNewChat"),
    modeList: document.getElementById("modeList"),
    currentModeLabel: document.getElementById("currentModeLabel"),
    memoryFeed: document.getElementById("memoryFeed"),
    statusPill: document.getElementById("statusPill"),
    statusText: document.getElementById("statusText"),
    btnOpenTeach: document.getElementById("btnOpenTeach"),
    btnQuickMenu: document.getElementById("btnQuickMenu"),
    btnToggleArtifact: document.getElementById("btnToggleArtifact"),
    btnCloseArtifact: document.getElementById("btnCloseArtifact"),
    artifactPanel: document.getElementById("artifactPanel"),
    artifactTitle: document.getElementById("artifactTitle"),
    artifactCode: document.getElementById("artifactCode"),
    btnCopyCode: document.getElementById("btnCopyCode"),
    btnThemeToggle: document.getElementById("btnThemeToggle"),
    chatStream: document.getElementById("chatStream"),
    chatForm: document.getElementById("chatForm"),
    promptInput: document.getElementById("promptInput"),
    btnSend: document.getElementById("btnSend"),
    btnStop: document.getElementById("btnStop"),
    composerHint: document.getElementById("composerHint"),
    connBanner: document.getElementById("connBanner"),
    connBannerText: document.getElementById("connBannerText"),
    btnConfigApi: document.getElementById("btnConfigApi"),
    teachModal: document.getElementById("teachModal"),
    btnCloseTeach: document.getElementById("btnCloseTeach"),
    btnCancelTeach: document.getElementById("btnCancelTeach"),
    btnSaveTeach: document.getElementById("btnSaveTeach"),
    teachTema: document.getElementById("teachTema"),
    teachDato: document.getElementById("teachDato"),
    teachPersona: document.getElementById("teachPersona"),
    teachTipo: document.getElementById("teachTipo"),
    cmdModal: document.getElementById("cmdModal"),
    btnCloseCmd: document.getElementById("btnCloseCmd"),
  };

  /* ------------------------------------------------------------------ *
   *  Utilidades
   * ------------------------------------------------------------------ */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  async function apiJson(path, opts = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(API_URL + path, {
        ...opts,
        signal: opts.signal || ctrl.signal,
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      });
      const texto = await r.text();
      let datos = null;
      try { datos = texto ? JSON.parse(texto) : null; } catch (_) { /* no json */ }
      if (!r.ok) {
        const detalle = datos && (datos.detail || datos.error);
        throw new Error(
          typeof detalle === "string" ? detalle : detalle ? JSON.stringify(detalle) : `HTTP ${r.status}`
        );
      }
      return datos;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Render de mensajes (markdown mínimo + bloques de código)
   * ------------------------------------------------------------------ */

  function inline(t) {
    let h = esc(t);
    h = h.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/^### (.*)$/gm, "<h4>$1</h4>");
    h = h.replace(/^## (.*)$/gm, "<h3>$1</h3>");
    h = h.replace(/^# (.*)$/gm, "<h3>$1</h3>");
    h = h.replace(/^\s*[-*] (.*)$/gm, "• $1");
    h = h.replace(/\n/g, "<br>");
    return h;
  }

  function bloqueCodigo(codigo, lenguaje) {
    const wrap = document.createElement("div");
    wrap.className = "code-block";

    const head = document.createElement("div");
    head.className = "code-head";

    const label = document.createElement("span");
    label.textContent = lenguaje || "código";

    const acciones = document.createElement("div");
    acciones.className = "code-actions";

    const bCopiar = document.createElement("button");
    bCopiar.type = "button";
    bCopiar.className = "mini-btn";
    bCopiar.textContent = "Copiar";
    bCopiar.onclick = () => {
      navigator.clipboard?.writeText(codigo).catch(() => {});
      bCopiar.textContent = "Copiado";
      setTimeout(() => { bCopiar.textContent = "Copiar"; }, 1200);
    };

    const bPanel = document.createElement("button");
    bPanel.type = "button";
    bPanel.className = "mini-btn";
    bPanel.textContent = "Panel";
    bPanel.onclick = () => setCode(lenguaje ? `código.${lenguaje}` : "código", codigo);

    acciones.append(bCopiar, bPanel);
    head.append(label, acciones);

    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codigo;
    pre.appendChild(code);

    wrap.append(head, pre);
    return wrap;
  }

  function renderInto(contenedor, texto) {
    contenedor.textContent = "";
    const partes = String(texto).split(/```/);

    partes.forEach((parte, i) => {
      if (i % 2 === 1) {
        const m = parte.match(/^([a-zA-Z0-9_+.#-]*)\r?\n/);
        const lenguaje = m ? m[1] : "";
        const cuerpo = (m ? parte.slice(m[0].length) : parte).replace(/\s+$/, "");
        contenedor.appendChild(bloqueCodigo(cuerpo, lenguaje));
      } else if (parte) {
        const div = document.createElement("div");
        div.className = "md-text";
        div.innerHTML = inline(parte);
        contenedor.appendChild(div);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   *  Scroll y mensajes
   * ------------------------------------------------------------------ */

  let scrollPendiente = false;
  function autoscroll() {
    if (scrollPendiente) return;
    scrollPendiente = true;
    requestAnimationFrame(() => {
      scrollPendiente = false;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
    });
  }

  let pintadoPendiente = null;
  let ultimoTexto = "";
  function pintar(burbuja, texto) {
    ultimoTexto = texto;
    if (pintadoPendiente) return;
    pintadoPendiente = requestAnimationFrame(() => {
      pintadoPendiente = null;
      renderInto(burbuja, ultimoTexto);
      autoscroll();
    });
  }

  function addMsg(role, texto) {
    el.chatStream?.querySelector(".welcome-hero")?.remove();
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    if (texto) renderInto(div, texto);
    el.chatStream?.appendChild(div);
    autoscroll();
    return div;
  }

  function setCode(titulo, codigo) {
    if (el.artifactTitle) el.artifactTitle.textContent = titulo;
    if (el.artifactCode) el.artifactCode.textContent = codigo;
    setArtifactOpen(true);
  }

  /* ------------------------------------------------------------------ *
   *  Estado del servidor
   * ------------------------------------------------------------------ */

  function pintarEstado(tipo, datos, error) {
    if (!el.statusPill || !el.statusText) return;

    const notas = state.memoria.length;
    el.statusPill.classList.remove("offline", "warn");

    if (tipo === "ok") {
      el.statusText.textContent = `Ember listo · ${notas} nota(s)`;
      el.connBanner?.classList.add("hidden");
    } else if (tipo === "sin-modelo") {
      el.statusPill.classList.add("warn");
      el.statusText.textContent = "Servidor sin modelo";
      if (el.connBannerText) {
        el.connBannerText.textContent = `Servidor conectado, pero el modelo no cargó: ${datos?.error || "revisa la terminal"}`;
      }
      el.connBanner?.classList.remove("hidden");
    } else {
      el.statusPill.classList.add("offline");
      el.statusText.textContent = "Sin conexión";
      if (el.connBannerText) {
        el.connBannerText.textContent = error
          ? `No puedo hablar con el servidor (${error}).`
          : "No puedo hablar con el servidor de Ember.";
      }
      el.connBanner?.classList.remove("hidden");
    }
  }

  async function comprobarEstado() {
    try {
      const d = await apiJson("/api/estado", {}, 5000);
      if (d && d.ok) {
        pintarEstado("ok", d);
        return d;
      }
      pintarEstado("sin-modelo", d);
      return d;
    } catch (err) {
      pintarEstado("offline", null, err.message);
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   *  Memoria
   * ------------------------------------------------------------------ */

  function memoriaLocal() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_MEM) || "[]");
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.conocimientos)) return d.conocimientos;
    } catch (_) { /* ignorar */ }
    return [];
  }

  function renderMemoria() {
    if (!el.memoryFeed) return;
    const items = state.memoria;

    if (!items.length) {
      el.memoryFeed.innerHTML = `<div class="empty-hint">Sin registros guardados aún.</div>`;
    } else {
      el.memoryFeed.innerHTML = items.slice(0, 40).map((x) => `
        <div class="memory-chip">
          <button class="chip-del" data-del="${esc(x.id || "")}" title="Borrar">×</button>
          <strong>${esc(x.tema || "?")}</strong>
          <span class="chip-tipo">${esc(x.tipo || "")}</span>
          <div class="chip-dato">${esc(String(x.dato || "").slice(0, 180))}</div>
        </div>`).join("");
    }

    if (el.statusText && !el.statusPill?.classList.contains("offline")) {
      el.statusText.textContent = `Ember listo · ${items.length} nota(s)`;
    }
  }

  async function cargarMemoria() {
    try {
      const d = await apiJson("/api/memoria", {}, 8000);
      state.memoria = Array.isArray(d?.items) ? d.items : [];
      localStorage.setItem(LS_MEM, JSON.stringify(state.memoria));
    } catch (_) {
      state.memoria = memoriaLocal();
    }
    renderMemoria();
  }

  /* ------------------------------------------------------------------ *
   *  Chat
   * ------------------------------------------------------------------ */

  function extraerUrls(t) {
    return (t.match(/https?:\/\/[^\s<>"')]+/gi) || []).slice(0, 5);
  }

  function calcular(texto) {
    const limpio = texto.trim().replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
    if (!/^[\d\s+\-*/().%^]+$/.test(limpio)) return null;
    if (!/[+\-*/%^]/.test(limpio)) return null;
    try {
      const valor = Function(`"use strict"; return (${limpio.replace(/\^/g, "**")});`)();
      if (typeof valor === "number" && Number.isFinite(valor)) {
        return `${limpio.trim()} = ${valor}`;
      }
    } catch (_) { /* no es una expresión válida */ }
    return null;
  }

  function fijarEnviando(v) {
    state.enviando = v;
    if (el.btnSend) {
      el.btnSend.disabled = v;
      el.btnSend.textContent = v ? "…" : "Enviar ➤";
    }
    el.btnStop?.classList.toggle("hidden", !v);
    if (el.composerHint) {
      el.composerHint.textContent = v ? "Generando en el teléfono…" : "Toca Enviar para consultar";
    }
  }

  function mensajeOffline(err) {
    const detalle = err && err.message ? `\n\nDetalle: \`${err.message}\`` : "";
    return [
      "**No pude conectar con el servidor de Ember.**",
      "",
      "Revisa en Termux:",
      "1. Que `python main.py` esté corriendo.",
      "2. Que la URL del servidor sea correcta (Comandos → Configurar URL).",
      "3. Que este navegador y el teléfono estén en la misma red.",
    ].join("\n") + detalle;
  }

  async function transmitir(payload, alDelta) {
    const ctrl = new AbortController();
    state.ctrl = ctrl;

    const r = await fetch(API_URL + "/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    if (!r.ok) {
      let detalle = `HTTP ${r.status}`;
      try {
        const d = await r.json();
        detalle = d.detail || d.error || detalle;
      } catch (_) { /* sin cuerpo */ }
      throw new Error(typeof detalle === "string" ? detalle : JSON.stringify(detalle));
    }
    if (!r.body) throw new Error("El servidor no devolvió stream.");

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    let acumulado = "";
    let errorServidor = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });

      let corte;
      while ((corte = buffer.indexOf("\n\n")) >= 0) {
        const bloque = buffer.slice(0, corte).trim();
        buffer = buffer.slice(corte + 2);
        if (!bloque.startsWith("data:")) continue;
        const dato = bloque.slice(5).trim();
        if (!dato) continue;

        let evento;
        try { evento = JSON.parse(dato); } catch (_) { continue; }

        if (evento.error) errorServidor = evento.error;
        if (evento.delta) {
          acumulado += evento.delta;
          alDelta(acumulado);
        }
      }
    }

    if (errorServidor) throw new Error(errorServidor);
    return acumulado;
  }

  async function enviar(texto) {
    const limpio = String(texto || "").trim();
    if (!limpio || state.enviando) return;

    addMsg("user", limpio);
    if (el.promptInput) {
      el.promptInput.value = "";
      el.promptInput.style.height = "auto";
    }

    const local = calcular(limpio);
    if (local) {
      addMsg("spark", `🧮 **Calculadora local** (sin IA): ${local}`);
      return;
    }

    fijarEnviando(true);

    let contexto = "";
    const urls = extraerUrls(limpio);
    if (urls.length) {
      const aviso = addMsg("spark", `Leyendo ${urls.length} enlace(s)…`);
      try {
        const d = await apiJson("/api/explorar", { method: "POST", body: JSON.stringify({ urls }) }, 30000);
        const res = Array.isArray(d?.resultados) ? d.resultados : [];
        if (res.length) {
          contexto = "\n\nContenido leído de los enlaces:\n" +
            res.map((x) => `[${x.titulo}] ${x.resumen}`).join("\n");
          cargarMemoria();
        }
      } catch (_) { /* seguimos sin contexto */ }
      aviso.remove();
    }

    const payload = {
      mensaje: limpio + contexto,
      historial: state.historial.slice(-8),
      modo: state.modo,
      nivel_razonamiento: "bajo",
    };

    const burbuja = addMsg("spark", "");
    burbuja.classList.add("streaming");
    burbuja.textContent = "Ember está pensando…";

    let parcial = "";
    const alDelta = (t) => pintar(burbuja, t);

    try {
      parcial = await transmitir(payload, alDelta);
      if (!parcial.trim()) throw new Error("respuesta vacía");
      renderInto(burbuja, parcial);
    } catch (err) {
      if (err.name === "AbortError") {
        renderInto(burbuja, (parcial ? parcial + "\n\n" : "") + "_(detenido)_");
        parcial = "";
      } else {
        try {
          const d = await apiJson("/api/chat", { method: "POST", body: JSON.stringify(payload) }, 180000);
          parcial = (d && d.respuesta) || "";
          if (!parcial.trim()) throw new Error(err.message || "respuesta vacía");
          renderInto(burbuja, parcial);
        } catch (err2) {
          renderInto(burbuja, mensajeOffline(err2));
          parcial = "";
        }
      }
    } finally {
      burbuja.classList.remove("streaming");
      state.ctrl = null;
      fijarEnviando(false);
    }

    if (parcial) {
      state.historial.push({ role: "user", content: limpio });
      state.historial.push({ role: "assistant", content: parcial });
      state.historial = state.historial.slice(-8);
      comprobarEstado();
    }
  }

  function resetChat() {
    if (!el.chatStream) return;
    state.historial = [];
    el.chatStream.innerHTML = `
      <div class="welcome-hero">
        <div class="hero-badge">EMBER // FUEGO &amp; CRISTAL</div>
        <h1 class="hero-title">Enciende tu código con precisión.</h1>
        <p class="hero-subtitle">
          Asistente de código que corre <strong>en tu teléfono</strong>, sin nube.
          Pregunta lo que quieras o pégame un enlace para leerlo.
        </p>
        <div class="quick-prompts">
          <button class="chip-fire" data-prompt="Explícame qué hace este código y cómo mejorarlo:">Revisar código</button>
          <button class="chip-fire" data-prompt="Escribe una función en Python que lea un archivo JSON y devuelva las claves ordenadas.">Función Python</button>
          <button class="chip-fire" data-prompt="250 * 8 + 100">Calculadora</button>
          <button class="chip-fire" data-prompt="¿Qué es una API REST? Explícalo breve.">¿Qué es una API?</button>
        </div>
      </div>`;
    bindChips();
  }

  function bindChips() {
    document.querySelectorAll(".chip-fire").forEach((b) => {
      b.onclick = () => enviar(b.getAttribute("data-prompt") || b.textContent || "");
    });
  }

  /* ------------------------------------------------------------------ *
   *  Panel de código
   * ------------------------------------------------------------------ */

  function setSidebarOpen(o) { el.sidebar?.classList.toggle("closed", !o); }
  function setArtifactOpen(o) { el.artifactPanel?.classList.toggle("hidden", !o); }

  /* ------------------------------------------------------------------ *
   *  Configuración y tema
   * ------------------------------------------------------------------ */

  function configurarApi() {
    const actual = API_URL || location.origin;
    const nueva = prompt("URL del servidor de Ember (vacío = mismo origen):", actual);
    if (nueva === null) return;

    const limpia = nueva.trim().replace(/\/+$/, "");
    if (limpia) localStorage.setItem(LS_API, limpia);
    else localStorage.removeItem(LS_API);
    API_URL = limpia;

    addMsg("spark", limpia
      ? `Servidor configurado: \`${limpia}\``
      : "Servidor: mismo origen (la web la sirve el propio teléfono).");
    comprobarEstado();
  }

  function alternarTema() {
    const r = document.documentElement;
    const nuevo = r.getAttribute("data-theme") === "light" ? "dark" : "light";
    r.setAttribute("data-theme", nuevo);
    localStorage.setItem(LS_THEME, nuevo);
  }

  /* ------------------------------------------------------------------ *
   *  Enseñar datos
   * ------------------------------------------------------------------ */

  function abrirTeach() {
    el.teachModal?.classList.remove("hidden");
    setSidebarOpen(false);
  }
  function cerrarTeach() { el.teachModal?.classList.add("hidden"); }

  async function guardarDato() {
    const tema = el.teachTema?.value.trim() || "";
    const dato = el.teachDato?.value.trim() || "";
    const persona = el.teachPersona?.value.trim() || "Alexi";
    const tipo = el.teachTipo?.value || "privada";
    if (!tema || !dato) return;

    try {
      await apiJson("/api/memoria", {
        method: "POST",
        body: JSON.stringify({ tema, dato, persona, tipo }),
      }, 10000);
      await cargarMemoria();
      addMsg("spark", `Guardado **${tema}** en memoria ${tipo} (${persona}).`);
    } catch (_) {
      state.memoria.unshift({
        id: "local-" + Date.now(),
        tema, dato, persona, tipo,
        ts: Date.now() / 1000,
      });
      localStorage.setItem(LS_MEM, JSON.stringify(state.memoria));
      renderMemoria();
      addMsg("spark", `Guardado **solo en este navegador**: el servidor no respondió.`);
    }

    if (el.teachTema) el.teachTema.value = "";
    if (el.teachDato) el.teachDato.value = "";
    cerrarTeach();
  }

  async function borrarDato(id) {
    if (!id) return;
    try {
      await apiJson(`/api/memoria/${encodeURIComponent(id)}`, { method: "DELETE" }, 8000);
      await cargarMemoria();
    } catch (_) {
      state.memoria = state.memoria.filter((x) => x.id !== id);
      localStorage.setItem(LS_MEM, JSON.stringify(state.memoria));
      renderMemoria();
    }
  }

  /* ------------------------------------------------------------------ *
   *  Eventos
   * ------------------------------------------------------------------ */

  el.btnOpenSidebar && (el.btnOpenSidebar.onclick = () => setSidebarOpen(true));
  el.btnCloseSidebar && (el.btnCloseSidebar.onclick = () => setSidebarOpen(false));
  el.btnNewChat && (el.btnNewChat.onclick = () => { resetChat(); setSidebarOpen(false); });

  el.modeList?.querySelectorAll(".mode-item").forEach((b) => {
    b.onclick = () => {
      el.modeList.querySelectorAll(".mode-item").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.modo = b.getAttribute("data-mode") || "general";
      if (el.currentModeLabel) el.currentModeLabel.textContent = state.modo;
      if (el.promptInput) el.promptInput.placeholder = PLACEHOLDERS[state.modo] || PLACEHOLDERS.general;
      setSidebarOpen(false);
    };
  });

  el.btnToggleArtifact && (el.btnToggleArtifact.onclick = () =>
    setArtifactOpen(el.artifactPanel?.classList.contains("hidden")));
  el.btnCloseArtifact && (el.btnCloseArtifact.onclick = () => setArtifactOpen(false));
  el.btnCopyCode && (el.btnCopyCode.onclick = () => {
    navigator.clipboard?.writeText(el.artifactCode?.textContent || "").catch(() => {});
    el.btnCopyCode.textContent = "Copiado";
    setTimeout(() => { el.btnCopyCode.textContent = "Copiar"; }, 1200);
  });

  el.btnThemeToggle && (el.btnThemeToggle.onclick = alternarTema);

  el.btnOpenTeach && (el.btnOpenTeach.onclick = abrirTeach);
  el.btnCloseTeach && (el.btnCloseTeach.onclick = cerrarTeach);
  el.btnCancelTeach && (el.btnCancelTeach.onclick = cerrarTeach);
  el.btnSaveTeach && (el.btnSaveTeach.onclick = guardarDato);

  el.btnQuickMenu && (el.btnQuickMenu.onclick = () => el.cmdModal?.classList.remove("hidden"));
  el.btnCloseCmd && (el.btnCloseCmd.onclick = () => el.cmdModal?.classList.add("hidden"));

  document.querySelectorAll(".menu-btn").forEach((b) => {
    b.onclick = () => {
      const accion = b.getAttribute("data-action");
      el.cmdModal?.classList.add("hidden");
      if (accion === "new") resetChat();
      if (accion === "teach") abrirTeach();
      if (accion === "artifact") setArtifactOpen(el.artifactPanel?.classList.contains("hidden"));
      if (accion === "theme") alternarTema();
      if (accion === "api") configurarApi();
      if (accion === "estado") comprobarEstado();
    };
  });

  el.btnConfigApi && (el.btnConfigApi.onclick = configurarApi);
  el.btnStop && (el.btnStop.onclick = () => state.ctrl?.abort());

  el.memoryFeed?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (btn) borrarDato(btn.getAttribute("data-del"));
  });

  el.chatForm && (el.chatForm.onsubmit = (e) => {
    e.preventDefault();
    enviar(el.promptInput?.value || "");
  });

  el.promptInput && (el.promptInput.oninput = () => {
    el.promptInput.style.height = "auto";
    el.promptInput.style.height = `${Math.min(el.promptInput.scrollHeight, 160)}px`;
  });

  el.promptInput && el.promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviar(el.promptInput.value);
    }
  });

  /* ------------------------------------------------------------------ *
   *  Arranque
   * ------------------------------------------------------------------ */

  const temaGuardado = localStorage.getItem(LS_THEME);
  if (temaGuardado) document.documentElement.setAttribute("data-theme", temaGuardado);

  renderMemoria();
  bindChips();
  cargarMemoria();
  comprobarEstado();
  setInterval(comprobarEstado, 20000);
})();
