(() => {
  const STORAGE_KEY = "spark_ia_web_memoria_v3";
  const API_URL = "http://127.0.0.1:8080";
  let currentMode = "general";
  let activeLang = "es";
  let lastCode = "// Editor Spark.IA";
  let profile = {
    name: "Spark.IA",
    gender: "femenina",
    role: "Asistente femenina del núcleo FLAME (ES/DE)",
  };

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
      return {
        conocimientos: Array.isArray(d.conocimientos) ? d.conocimientos : [],
        cuenta: d.cuenta || profile,
      };
    } catch (_) {
      return { conocimientos: [], cuenta: profile };
    }
  }

  function saveMemory(m) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch (_) {}
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderMemory() {
    const m = loadMemory();
    profile = m.cuenta || profile;
    if (el.statusText) {
      el.statusText.textContent = `${profile.name} (♀ ${activeLang.toUpperCase()}) · ${m.conocimientos.length} notas`;
    }
    if (!el.memoryFeed) return;
    const headerCard = `<div class="memory-chip"><strong>Cuenta:</strong> ${esc(profile.name)} · Identidad ${esc(profile.gender)}</div>`;
    if (!m.conocimientos.length) {
      el.memoryFeed.innerHTML = headerCard + `<div class="empty-hint">Sin registros guardados aún.</div>`;
      return;
    }
    el.memoryFeed.innerHTML = headerCard + m.conocimientos.slice().reverse()
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
    if (/^(español|espanol|en español|habla español|spanish)$/i.test(text.trim())) {
      activeLang = "es";
      return "es";
    }
    if (/^(alemán|aleman|deutsch|auf deutsch|german)$/i.test(text.trim())) {
      activeLang = "de";
      return "de";
    }
    const hasDeWords = /\b(ich|du|wir|was|wie|ist|sind|bitte|danke|hallo|guten tag)\b|[äöüß]/i.test(lower);
    const hasEsWords = /\b(hola|que|qué|como|cómo|dame|codigo|código|tiempo|palabra|nuevo|nueva|cuenta|mujer)\b|[ñáéíóú¿¡]/i.test(lower);
    if (hasEsWords && !hasDeWords) { activeLang = "es"; return "es"; }
    if (hasDeWords && !hasEsWords) { activeLang = "de"; return "de"; }
    return activeLang;
  }

  function tryCodeRequest(lower, lang) {
    if (/\bjava\b/i.test(lower)) {
      setCode("Main.java", `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Spark.IA activa en Java");\n    }\n}`);
      return lang === "de"
        ? "Ich habe ein Basis-Beispiel in Java im Code-Editor ({ }) geöffnet."
        : "Te preparé una base en Java y la abrí en el panel de código ({ }).";
    }
    if (/\brust\b/i.test(lower)) {
      setCode("main.rs", `fn main() {\n    println!("Spark.IA activa en Rust");\n}`);
      return lang === "de"
        ? "Ich habe ein Basis-Beispiel in Rust im Code-Editor ({ }) geöffnet."
        : "Te dejé una base en Rust abierta en el panel de código ({ }).";
    }
    if (/\b(javascript|js)\b/i.test(lower)) {
      setCode("script.js", `export function runSpark() {\n  console.log("Spark.IA activa en JS");\n}`);
      return lang === "de"
        ? "Ich habe ein Basis-Beispiel in JavaScript im Code-Editor ({ }) geöffnet."
        : "Te dejé una base en JavaScript abierta en el panel de código ({ }).";
    }
    return null;
  }

  function calcExpr(t, lang) {
    const clean = t.replace(/×/g, "*").replace(/÷/g, "/").replace(/\^/g, "**");
    const m = clean.match(/[\d(][\d\s+\-*/().%]*[\d)]/);
    if (m && /[+\-*/%]/.test(m[0]) && /^[0-9+\-*/().%\s*]+$/.test(m[0])) {
      try {
        const val = Function(`"use strict"; return (${m[0]});`)();
        if (typeof val === "number" && Number.isFinite(val)) {
          return lang === "de" ? `Rechner: ${m[0].trim()} = ${val}` : `Calculadora: ${m[0].trim()} = ${val}`;
        }
      } catch (_) {}
    }
    return null;
  }

  function replySmart(raw) {
    const { out, notes } = fixTypos(raw);
    const q = out.toLowerCase().trim();
    const lang = resolveLang(out, q);
    const prefix = notes.length ? `[Corrección: ${notes.join(", ")}]\n` : "";

    if (/^(español|espanol|en español|habla español)$/i.test(q)) {
      renderMemory();
      return prefix + "Listo, cambiamos a español. Estoy lista para ayudarte.";
    }
    if (/^(alemán|aleman|deutsch|auf deutsch)$/i.test(q)) {
      renderMemory();
      return prefix + "Alles klar, wir sprechen jetzt auf Deutsch. Ich bin bereit.";
    }

    if (/\b(cuenta|mujer|femenina|genero|género)\b/i.test(q)) {
      const m = loadMemory();
      m.cuenta = { name: "Spark.IA", gender: "femenina", role: "Asistente femenina del núcleo FLAME" };
      saveMemory(m);
      renderMemory();
      return prefix + (lang === "de"
        ? "Dein Konto für Spark.IA ist mit weiblicher Identität gespeichert. Sie gibt dir damit einen klaren Stil und Charakter, auch wenn technische Grenzen separat behandelt werden."
        : "Tu cuenta de Spark.IA quedó configurada con identidad femenina. Eso le da carácter y constancia al hablar, aunque la capacidad técnica y las reglas del sistema se trabajan aparte.");
    }

    const mem = loadMemory();
    for (let i = mem.conocimientos.length - 1; i >= 0; i--) {
      const it = mem.conocimientos[i];
      if (q.includes(it.tema.toLowerCase()) || it.tema.toLowerCase().includes(q)) {
        return prefix + `[Memoria // ${it.tema}] (${it.persona || "Alexi"}): ${it.dato}`;
      }
    }

    const codeAns = tryCodeRequest(q, lang);
    if (codeAns) return prefix + codeAns;

    const calcAns = calcExpr(out, lang);
    if (calcAns) return prefix + calcAns;

    if (/\b(plugin|plugins|termux|editor|tor|aloha|mt manager|navegador|calculadora)\b/i.test(q)) {
      setCode("plugins_flame.txt", "Plugins listos: Navegador, Editor { }, Calculadora avanzada, Termux, Tor/Aloha y MT Manager.");
      return prefix + (lang === "de"
        ? "Ich habe die Module für Navegador, Code-Editor ({ }), Rechner sowie Termux, Tor/Aloha und MT Manager bereit."
        : "Tengo listos los módulos de Navegador, Editor de código ({ }), Calculadora avanzada y perfiles para Termux, Tor/Aloha y MT Manager.");
    }

    if (/\bzeit\b/i.test(out) || q.includes("flamedash")) {
      setCode("ejemplo_zeit.fm", "!stil flamedash\narea= 512x400\nRipetox=2\nactivision~Zeit=inmediato\nactionscript~Zeit=500.ms\nactende~Zeit=original");
      return prefix + (lang === "de"
        ? '"Zeit" steuert in flamedash Ablauf und Phasen zusammen mit Ripetox.'
        : '"Zeit" controla los tiempos y fases en flamedash junto con Ripetox.');
    }

    if (/^(hola|buenas|hey|hi|hallo|guten tag)\b/i.test(q)) {
      return prefix + (lang === "de"
        ? "Hallo! Ich bin Spark.IA. Wir können auf Deutsch oder Spanisch über FLAME, ~Zeit, Code oder neue Ideen sprechen."
        : "¡Hola! Soy Spark.IA. Podemos hablar en español o alemán sobre FLAME, ~Zeit, código o lo que quieras crear.");
    }

    return prefix + (lang === "de"
      ? `Zu "${out}" habe ich noch keinen festen Eintrag, aber ich bleibe aktiv: Sag mir, ob es um FLAME, ~Zeit, Code oder ein neues Wort geht.`
      : `Sobre "${out}" aún no tengo una regla fija, pero sigo activa: dime si va por FLAME, ~Zeit, código o una palabra nueva.`);
  }

  async function sendMsg(txt) {
    const clean = txt.trim();
    if (!clean) return;
    addMsg("user", clean);
    if (el.promptInput) { el.promptInput.value = ""; el.promptInput.style.height = "auto"; }
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
    el.chatStream.innerHTML = `<div class="welcome-hero"><div class="hero-badge">SPARK.IA // ES·DE</div><h1 class="hero-title">Enciende tu código con precisión.</h1><div class="quick-prompts"><button class="chip-fire" data-prompt="Was ist Zeit?">Alemán / Zeit</button><button class="chip-fire" data-prompt="Dame código de Java">Código Java</button><button class="chip-fire" data-prompt="(250 * 8) + 100">Calculadora</button></div></div>`;
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
    const m = loadMemory();
    m.conocimientos.push({ tema, dato, persona });
    saveMemory(m);
    renderMemory();
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
