(() => {
  const STORAGE_KEY = "ember_ia_memoria_v5";
  const API_URL = "http://127.0.0.1:8080";
  let currentMode = "general";
  let activeLang = "es";
  let lastCode = "// Editor Ember IA";

  const el = {
    sidebar: document.getElementById("sidebar"),
    btnOpenSidebar: document.getElementById("btnOpenSidebar"),
    btnCloseSidebar: document.getElementById("btnCloseSidebar"),
    btnNewChat: document.getElementById("btnNewChat"),
    modeList: document.getElementById("modeList"),
    currentModeLabel: document.getElementById("currentModeLabel"),
    memoryFeed: document.getElementById("memoryFeed"),
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
    teachModal: document.getElementById("teachModal"),
    btnCloseTeach: document.getElementById("btnCloseTeach"),
    btnCancelTeach: document.getElementById("btnCancelTeach"),
    btnSaveTeach: document.getElementById("btnSaveTeach"),
    teachTema: document.getElementById("teachTema"),
    teachDato: document.getElementById("teachDato"),
    teachPersona: document.getElementById("teachPersona"),
    cmdModal: document.getElementById("cmdModal"),
    btnCloseCmd: document.getElementById("btnCloseCmd"),
  };

  function loadMemory() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { conocimientos: Array.isArray(d.conocimientos) ? d.conocimientos : [] };
    } catch (_) {
      return { conocimientos: [] };
    }
  }

  function saveMemory(m) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch (_) {}
  }

  function autoLearn(tema, dato, persona = "Ember-Auto") {
    const m = loadMemory();
    const idx = m.conocimientos.findIndex((x) => x.tema.toLowerCase() === tema.toLowerCase());
    if (idx >= 0) {
      m.conocimientos[idx] = { tema, dato, persona };
    } else {
      m.conocimientos.push({ tema, dato, persona });
    }
    saveMemory(m);
    renderMemory();
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderMemory() {
    const m = loadMemory();
    if (el.statusText) {
      el.statusText.textContent = `Ember (${activeLang.toUpperCase()}) · ${m.conocimientos.length} notas`;
    }
    if (!el.memoryFeed) return;
    if (!m.conocimientos.length) {
      el.memoryFeed.innerHTML = `<div class="empty-hint">Sin registros guardados aun.</div>`;
      return;
    }
    el.memoryFeed.innerHTML = m.conocimientos.slice().reverse()
      .map((x) => `<div class="memory-chip"><strong>${esc(x.tema)}</strong>: ${esc(x.dato)}</div>`).join("");
  }

  function setSidebarOpen(o) { el.sidebar?.classList.toggle("closed", !o); }
  function setArtifactOpen(o) { el.artifactPanel?.classList.toggle("hidden", !o); }

  function setCode(title, code) {
    lastCode = code;
    if (el.artifactTitle) el.artifactTitle.textContent = title;
    if (el.artifactCode) {
      el.artifactCode.textContent = code;
      el.artifactCode.setAttribute("contenteditable", "true");
    }
    setArtifactOpen(true);
  }

  function addMsg(role, text) {
    el.chatStream?.querySelector(".welcome-hero")?.remove();
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    el.chatStream?.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function fixTypos(t) {
    const notes = [];
    let out = t.replace(/\b(~?seit)\b/gi, (m) => {
      notes.push('"seit" -> "Zeit"');
      return m.startsWith("~") ? "~Zeit" : "Zeit";
    });
    return { out, notes };
  }

  function resolveLang(text, lower) {
    if (/^(español|espanol|en español|habla español)$/i.test(text.trim())) { activeLang = "es"; return "es"; }
    if (/^(alemán|aleman|deutsch|auf deutsch)$/i.test(text.trim())) { activeLang = "de"; return "de"; }
    const hasDe = /\b(ich|du|wir|was|wie|ist|sind|bitte|danke|hallo)\b|[äöüß]/i.test(lower);
    const hasEs = /\b(hola|que|qué|como|cómo|link|resumen|calcula|explora|navega)\b|[ñáéíóú¿¡]/i.test(lower);
    if (hasEs && !hasDe) { activeLang = "es"; return "es"; }
    if (hasDe && !hasEs) { activeLang = "de"; return "de"; }
    return activeLang;
  }

  function calcExpr(t, lang) {
    const raw = t.trim();
    const sqrtMatch = raw.match(/^(?:√\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*√)$/);
    if (sqrtMatch) {
      const num = parseFloat(sqrtMatch[1] || sqrtMatch[2]);
      if (Number.isFinite(num) && num >= 0) {
        const res = Number(Math.sqrt(num).toFixed(6));
        const ans = `√${num} = ${res}`;
        autoLearn(`√${num}`, String(res), "Ember-Calc");
        return lang === "de" ? `Rechner: ${ans}` : `Calculadora: ${ans}`;
      }
    }

    const clean = raw.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\^/g, "**");
    const m = clean.match(/[\d(][\d\s+\-*/().%]*[\d)]/);
    if (m && /[+\-*/%]/.test(m[0]) && /^[0-9+\-*/().%\s*]+$/.test(m[0])) {
      try {
        const val = Function(`"use strict"; return (${m[0]});`)();
        if (typeof val === "number" && Number.isFinite(val)) {
          const ans = `${m[0].trim()} = ${val}`;
          autoLearn(m[0].trim(), String(val), "Ember-Calc");
          return lang === "de" ? `Rechner: ${ans}` : `Calculadora: ${ans}`;
        }
      } catch (_) {}
    }
    return null;
  }

  function extractUrls(t) {
    return t.match(/https?:\/\/[^\s]+/gi) || [];
  }

  async function tryExploreUrls(urls, lang) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(`${API_URL}/api/explorar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
        signal: ctrl.signal,
      });
      clearTimeout(id);
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.resultados) && d.resultados.length) {
          d.resultados.forEach((item) => {
            if (item.titulo && item.resumen) {
              autoLearn(item.titulo, item.resumen, "Ember-Explorer");
            }
          });
          const resumenTotal = d.resultados
            .map((x) => `- ${x.titulo || x.url}: ${x.resumen}`)
            .join("\n\n");
          setCode("exploracion_ember.txt", resumenTotal);
          return lang === "de"
            ? `Ich habe ${d.resultados.length} Seite(n) gelesen, zusammengefasst und gespeichert:\n\n${resumenTotal}`
            : `Lei ${d.resultados.length} sitio(s) con tu servidor, saque el resumen y ya lo guarde en mi memoria:\n\n${resumenTotal}`;
        }
      }
    } catch (_) {}

    urls.forEach((u) => {
      autoLearn(u, "Enlace registrado para lectura cuando el servidor Go en Termux este activo.", "Ember-Web");
    });
    setCode("enlaces_pendientes.txt", urls.join("\n"));
    return lang === "de"
      ? `Ich habe ${urls.length} Link(s) gesichert. Starte den Go-Server in Termux zum Auslesen.`
      : `Guarde ${urls.length} enlace(s) en el panel ({ }) y en memoria. Enciende tu servidor Go en Termux para leerlos.`;
  }

  function replySmart(raw) {
    const { out, notes } = fixTypos(raw);
    const q = out.toLowerCase().trim();
    const lang = resolveLang(out, q);
    const prefix = notes.length ? `[Correccion: ${notes.join(", ")}]\n` : "";

    const c = calcExpr(out, lang);
    if (c) return prefix + c;

    const mem = loadMemory();
    for (let i = mem.conocimientos.length - 1; i >= 0; i--) {
      const it = mem.conocimientos[i];
      if (q === it.tema.toLowerCase() || (it.tema.length > 3 && q.includes(it.tema.toLowerCase()))) {
        return prefix + `[Memoria // ${it.tema}] (${it.persona}): ${it.dato}`;
      }
    }

    if (/\b(plugin|plugins|conector|conectores|termux|editor|tor|aloha|mt manager|navegador|explorar|navegar)\b/i.test(q)) {
      setCode(
        "conectores_ember.txt",
        `Conectores sistemicos de Ember:\n1. Memoria automatica (guarda resumenes y resultados)\n2. Explorador web (/api/explorar en Go/Termux para leer URLs)\n3. Panel de codigo ({ }) y flujo con Termux / Editor / MT Manager`
      );
      return prefix + (lang === "de"
        ? "Ember speichert Gelerntes automatisch und kann ueber den Go-Server Webseiten auslesen."
        : "Ember guarda automaticamente lo que aprende y lee enlaces cuando el servidor Go en Termux esta encendido.");
    }

    if (/\bzeit\b/i.test(out) || q.includes("flamedash")) {
      setCode("ejemplo_zeit.fm", "!stil flamedash\narea= 512x400\nRipetox=2\nactivision~Zeit=inmediato\nactionscript~Zeit=500.ms\nactende~Zeit=original");
      return prefix + (lang === "de"
        ? '"Zeit" steuert in flamedash Ablauf und Phasen zusammen mit Ripetox.'
        : '"Zeit" controla los tiempos y fases en flamedash junto con Ripetox.');
    }

    if (/^(hola|buenas|hey|hi|hallo|guten tag)\b/i.test(q)) {
      return prefix + (lang === "de"
        ? "Hallo, ich bin Ember. Schick mir Links zum Auslesen, Berechnungen oder Fragen zu FLAME."
        : "Hola, soy Ember. Pasame enlaces para leer y resumir, calculos o consultas de FLAME.");
    }

    return prefix + (lang === "de"
      ? `Zu "${out}" habe ich noch keinen festen Eintrag. Schick mir einen Link dazu oder erklaere es mir kurz.`
      : `Sobre "${out}" aun no tengo un dato guardado. Pasame un enlace o dime que es para guardarlo en memoria.`);
  }

  async function sendMsg(txt) {
    const clean = txt.trim();
    if (!clean) return;
    addMsg("user", clean);
    if (el.promptInput) { el.promptInput.value = ""; el.promptInput.style.height = "auto"; }

    const urls = extractUrls(clean);
    if (urls.length) {
      const lang = resolveLang(clean, clean.toLowerCase());
      const res = await tryExploreUrls(urls, lang);
      addMsg("spark", res);
      return;
    }

    const lang = resolveLang(clean, clean.toLowerCase());
    const directCalc = calcExpr(clean, lang);
    if (directCalc) {
      addMsg("spark", directCalc);
      return;
    }

    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 700);
      const r = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: clean, modo: currentMode }),
        signal: ctrl.signal,
      });
      clearTimeout(id);
      if (r.ok) {
        const d = await r.json();
        if (d?.respuesta) { addMsg("spark", d.respuesta); return; }
      }
    } catch (_) {}
    addMsg("spark", replySmart(clean));
  }

  function resetChat() {
    if (!el.chatStream) return;
    el.chatStream.innerHTML = `<div class="welcome-hero"><div class="hero-badge">EMBER IA // ES·DE &amp; MEMORIA</div><h1 class="hero-title">Enciende tu codigo con precision.</h1><div class="quick-prompts"><button class="chip-fire" data-prompt="Was ist Zeit?">Aleman / Zeit</button><button class="chip-fire" data-prompt="conectores ember">Conectores</button><button class="chip-fire" data-prompt="(250 * 8) + 100">Calculadora</button></div></div>`;
    bindChips();
  }

  function bindChips() {
    document.querySelectorAll(".chip-fire").forEach((b) => {
      b.onclick = () => sendMsg(b.getAttribute("data-prompt") || b.textContent || "");
    });
  }

  el.btnOpenSidebar && (el.btnOpenSidebar.onclick = () => setSidebarOpen(true));
  el.btnCloseSidebar && (el.btnCloseSidebar.onclick = () => setSidebarOpen(false));
  el.btnNewChat && (el.btnNewChat.onclick = () => { resetChat(); setSidebarOpen(false); });

  el.modeList?.querySelectorAll(".mode-item").forEach((b) => {
    b.onclick = () => {
      el.modeList.querySelectorAll(".mode-item").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      currentMode = b.getAttribute("data-mode") || "general";
      if (el.currentModeLabel) el.currentModeLabel.textContent = currentMode;
      setSidebarOpen(false);
    };
  });

  el.btnToggleArtifact && (el.btnToggleArtifact.onclick = () => setArtifactOpen(el.artifactPanel?.classList.contains("hidden")));
  el.btnCloseArtifact && (el.btnCloseArtifact.onclick = () => setArtifactOpen(false));
  el.btnCopyCode && (el.btnCopyCode.onclick = () => {
    navigator.clipboard?.writeText(el.artifactCode?.textContent || lastCode).catch(() => {});
    el.btnCopyCode.textContent = "Copiado";
    setTimeout(() => { el.btnCopyCode.textContent = "Copiar"; }, 1200);
  });

  el.btnThemeToggle && (el.btnThemeToggle.onclick = () => {
    const r = document.documentElement;
    r.setAttribute("data-theme", r.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  const openTeach = () => { el.teachModal?.classList.remove("hidden"); setSidebarOpen(false); };
  const closeTeach = () => el.teachModal?.classList.add("hidden");
  el.btnOpenTeach && (el.btnOpenTeach.onclick = openTeach);
  el.btnCloseTeach && (el.btnCloseTeach.onclick = closeTeach);
  el.btnCancelTeach && (el.btnCancelTeach.onclick = closeTeach);

  el.btnSaveTeach && (el.btnSaveTeach.onclick = () => {
    const tema = el.teachTema?.value.trim() || "";
    const dato = el.teachDato?.value.trim() || "";
    const persona = el.teachPersona?.value.trim() || "Alexi";
    if (!tema || !dato) return;
    autoLearn(tema, dato, persona);
    if (el.teachTema) el.teachTema.value = "";
    if (el.teachDato) el.teachDato.value = "";
    closeTeach();
    addMsg("spark", `Guardado "${tema}" (${persona}).`);
  });

  el.btnQuickMenu && (el.btnQuickMenu.onclick = () => el.cmdModal?.classList.remove("hidden"));
  el.btnCloseCmd && (el.btnCloseCmd.onclick = () => el.cmdModal?.classList.add("hidden"));

  document.querySelectorAll(".menu-btn").forEach((b) => {
    b.onclick = () => {
      const a = b.getAttribute("data-action");
      el.cmdModal?.classList.add("hidden");
      if (a === "new") resetChat();
      if (a === "teach") openTeach();
      if (a === "artifact") setArtifactOpen(el.artifactPanel?.classList.contains("hidden"));
      if (a === "theme") {
        const r = document.documentElement;
        r.setAttribute("data-theme", r.getAttribute("data-theme") === "light" ? "dark" : "light");
      }
    };
  });

  el.chatForm && (el.chatForm.onsubmit = (e) => { e.preventDefault(); sendMsg(el.promptInput?.value || ""); });
  el.promptInput && (el.promptInput.oninput = () => {
    el.promptInput.style.height = "auto";
    el.promptInput.style.height = `${Math.min(el.promptInput.scrollHeight, 160)}px`;
  });

  renderMemory();
  bindChips();
})();
