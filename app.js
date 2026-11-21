(() => {
  const STORAGE_KEY = "spark_ia_web_memoria_v1";
  const API_URL = "http://127.0.0.1:8080";

  let currentMode = "general";
  let lastCode = "// Aquí aparecerá el código generado.";

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
    btnSend: document.getElementById("btnSend"),
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { conocimientos: [] };
      const parsed = JSON.parse(raw);
      return {
        conocimientos: Array.isArray(parsed.conocimientos) ? parsed.conocimientos : [],
      };
    } catch (_) {
      return { conocimientos: [] };
    }
  }

  function saveMemory(mem) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
    } catch (_) {}
  }

  function renderMemoryFeed() {
    const mem = loadMemory();
    el.statusText.textContent = `Memoria: ${mem.conocimientos.length} aprendidos`;
    if (!mem.conocimientos.length) {
      el.memoryFeed.innerHTML = `<div class="empty-hint">Sin registros recientes.</div>`;
      return;
    }
    el.memoryFeed.innerHTML = mem.conocimientos
      .slice()
      .reverse()
      .map(
        (item) =>
          `<div class="memory-chip"><strong>${escapeHtml(item.tema)}</strong>: ${escapeHtml(item.dato)}</div>`
      )
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setSidebarOpen(open) {
    if (!el.sidebar) return;
    if (open) {
      el.sidebar.classList.remove("closed");
    } else {
      el.sidebar.classList.add("closed");
    }
  }

  function setArtifactOpen(open) {
    if (!el.artifactPanel) return;
    if (open) {
      el.artifactPanel.classList.remove("hidden");
    } else {
      el.artifactPanel.classList.add("hidden");
    }
  }

  function setCodeArtifact(title, code) {
    lastCode = code;
    if (el.artifactTitle) el.artifactTitle.textContent = title;
    if (el.artifactCode) el.artifactCode.textContent = code;
    setArtifactOpen(true);
  }

  function appendMessage(role, text) {
    const hero = el.chatStream.querySelector(".welcome-hero");
    if (hero) hero.remove();

    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    el.chatStream.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function resetChat() {
    el.chatStream.innerHTML = `
      <div class="welcome-hero">
        <div class="hero-badge">SPARK.IA // FUEGO &amp; CRISTAL</div>
        <h1 class="hero-title">Enciende tu código con precisión.</h1>
        <p class="hero-subtitle">
          Pregunta por <code>flamedash</code>, calcula tiempos, genera código base o prueba palabras nuevas como <code>patatim</code>.
        </p>
        <div class="quick-prompts">
          <button class="chip-fire" data-prompt="flamedash">flamedash</button>
          <button class="chip-fire" data-prompt="generar codigo flame, js y rust">Plantillas FLAME / JS / Rust</button>
          <button class="chip-fire" data-prompt="250.ms * Ripetox=8 en s">Calcular ~zeit</button>
          <button class="chip-fire" data-prompt="patatim">Probar patatim</button>
        </div>
      </div>
    `;
    bindQuickPrompts();
  }

  function tryMath(text) {
    const clean = text.replace(/×/g, "*").replace(/\*\*/g, "^");
    // Repetox: ej. 250.ms * Ripetox=8 en s
    const repMatch = clean.match(/(\d+(?:\.\d+)?)\.(ms|s|m|h)[^\d\n]+(?:ripetox|repeticiones|veces)\s*=?\s*(\d+)/i);
    if (repMatch) {
      const val = parseFloat(repMatch[1]);
      const unit = repMatch[2].toLowerCase();
      const rep = parseFloat(repMatch[3]);
      const total = val * rep;
      const toS = clean.match(/\ben\s+s\b/i);
      if (toS && unit === "ms") {
        return `Spark: ${val}.ms × Ripetox=${rep} = ${total}.ms (${total / 1000}.s)`;
      }
      return `Spark: ${val}.${unit} × Ripetox=${rep} = ${total}.${unit}`;
    }

    // Expresión matemática simple
    const exprMatch = clean.match(/(?:-?\d+(?:\.\d+)?|\()[\d\s+\-*/%^().]*[\d\)]/);
    if (exprMatch && /[+\-*/%^]/.test(exprMatch[0])) {
      const expr = exprMatch[0].replace(/\^/g, "**");
      if (/^[0-9+\-*/().%\s*]+$/.test(expr)) {
        try {
          const result = Function(`"use strict"; return (${expr});`)();
          if (typeof result === "number" && Number.isFinite(result)) {
            return `Spark: Resultado de ${exprMatch[0].trim()} = ${result}`;
          }
        } catch (_) {}
      }
    }
    return null;
  }

  function generateTemplates() {
    const code = `// --- FLAME (.fm) ---
!stil flamedash
area= 512×400
Ripetox=2
activision~zeit=inmediato
actionscript~zeit=250.ms
actende~zeit=original

// --- JavaScript ---
export function runFlameStep(repeticiones = 2) {
  for (let i = 1; i <= repeticiones; i++) {
    console.log("Ciclo Spark:", i);
  }
}

// --- Rust ---
pub fn run_flame_step(repeticiones: usize) {
    for i in 1..=repeticiones {
        println!("Ciclo Spark: {}", i);
    }
}`;
    setCodeArtifact("plantillas_flame_js_rust.txt", code);
    return "Spark: Generé las plantillas base de FLAME, JavaScript y Rust. Las abrí en el panel de código ({ }).";
  }

  function localSparkReply(rawText) {
    const text = rawText.trim();
    if (!text) return "Spark: Escribe algo para que pueda ayudarte.";

    const mem = loadMemory();
    const q = text.toLowerCase();

    // 1. Buscar en memoria aprendida
    for (let i = mem.conocimientos.length - 1; i >= 0; i--) {
      const item = mem.conocimientos[i];
      if (item.tema.toLowerCase().includes(q) || item.dato.toLowerCase().includes(q) || q.includes(item.tema.toLowerCase())) {
        return `[SPARK-MEMORIA // TEMA: ${item.tema}]\nSpark: Me acuerdo de esto —me lo aportó ${item.persona || "Alexi"}.\nDato: ${item.dato}`;
      }
    }

    // 2. Cálculos y ~zeit
    const mathAns = tryMath(text);
    if (mathAns) return mathAns;

    // 3. Generación de código FLAME / JS / Rust
    if (q.includes("generar") || q.includes("plantilla") || q.includes("rust") || q.includes("javascript") || q.includes("js")) {
      return generateTemplates();
    }

    // 4. Conocimiento base de FLAME y modos
    if (q.includes("flamedash") || q.includes("dash") || currentMode === "flamedash") {
      setCodeArtifact(
        "ejemplo.fm",
        `!stil flamedash\narea= 512×400\nRipetox=1\nactivision~zeit=inmediato\nactionscript~zeit=1.s\nactende~zeit=original`
      );
      return "Spark: flamedash controla fases y tiempos con ~zeit (inmediato, original, infinito o .ms/.s/.m/.h), area y Ripetox.";
    }

    if (q.includes("flamecode") || currentMode === "flamecode") {
      setCodeArtifact(
        "principal.fm",
        `!stil flamecode\nhaupt:\n  drucken! = "Hola desde FLAME":`
      );
      return "Spark: flamecode es la base del código en FLAME y suele iniciar en 'haupt'.";
    }

    if (q.includes("flameformel") || currentMode === "flameformel") {
      return "Spark: flameformel está pensado para fórmulas, reglas y estructuras reutilizables dentro del ecosistema FLAME.";
    }

    if (q.includes("sitmob") || q.includes("auditar") || currentMode === "sitmob") {
      return "Spark: SitMoB revisa patrones sensibles o riesgos en scripts y bloques de ejecución.";
    }

    // 5. Palabra desconocida (como "patatim")
    return `Spark: Todavía no conozco "${text}" ni en FLAME ni en mi memoria aprendida. Si tocas "+ Enseñar dato" en el menú, puedes explicarme qué es "${text}" y lo recordaré.`;
  }

  async function handleSendMessage(text) {
    const clean = text.trim();
    if (!clean) return;

    appendMessage("user", clean);
    el.promptInput.value = "";
    el.promptInput.style.height = "auto";

    // Intenta conectar al servidor local en Go si está activo; si no, responde en el navegador
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900);
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: clean, modo: currentMode }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.respuesta) {
          appendMessage("spark", data.respuesta);
          return;
        }
      }
    } catch (_) {}

    appendMessage("spark", localSparkReply(clean));
  }

  function bindQuickPrompts() {
    document.querySelectorAll(".chip-fire").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-prompt") || btn.textContent;
        handleSendMessage(p);
      });
    });
  }

  // Eventos de menú lateral
  el.btnOpenSidebar?.addEventListener("click", () => setSidebarOpen(true));
  el.btnCloseSidebar?.addEventListener("click", () => setSidebarOpen(false));
  el.btnNewChat?.addEventListener("click", () => {
    resetChat();
    setSidebarOpen(false);
  });

  // Selección de modos
  el.modeList?.querySelectorAll(".mode-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.modeList.querySelectorAll(".mode-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.getAttribute("data-mode") || "general";
      if (el.currentModeLabel) el.currentModeLabel.textContent = currentMode;
      setSidebarOpen(false);
    });
  });

  // Panel de código
  el.btnToggleArtifact?.addEventListener("click", () => {
    const isHidden = el.artifactPanel.classList.contains("hidden");
    setArtifactOpen(isHidden);
  });
  el.btnCloseArtifact?.addEventListener("click", () => setArtifactOpen(false));
  el.btnCopyCode?.addEventListener("click", () => {
    navigator.clipboard?.writeText(lastCode).catch(() => {});
    el.btnCopyCode.textContent = "Copiado";
    setTimeout(() => {
      el.btnCopyCode.textContent = "Copiar";
    }, 1200);
  });

  // Tema claro / oscuro
  el.btnThemeToggle?.addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
  });

  // Modal Enseñar
  const openTeach = () => {
    el.teachModal?.classList.remove("hidden");
    setSidebarOpen(false);
  };
  const closeTeach = () => el.teachModal?.classList.add("hidden");

  el.btnOpenTeach?.addEventListener("click", openTeach);
  el.btnCloseTeach?.addEventListener("click", closeTeach);
  el.btnCancelTeach?.addEventListener("click", closeTeach);

  el.btnSaveTeach?.addEventListener("click", () => {
    const tema = el.teachTema.value.trim();
    const dato = el.teachDato.value.trim();
    const persona = el.teachPersona.value.trim() || "Alexi";
    if (!tema || !dato) return;

    const mem = loadMemory();
    mem.conocimientos.push({ tema, dato, persona, fecha: new Date().toISOString() });
    saveMemory(mem);
    renderMemoryFeed();

    el.teachTema.value = "";
    el.teachDato.value = "";
    closeTeach();
    appendMessage("spark", `Spark: Guardé "${tema}" en memoria (aporte de ${persona}). Ya puedes preguntarme por "${tema}".`);
  });

  // Menú de comandos rápidos (sin atajos de teclado)
  el.btnQuickMenu?.addEventListener("click", () => el.cmdModal?.classList.remove("hidden"));
  el.btnCloseCmd?.addEventListener("click", () => el.cmdModal?.classList.add("hidden"));

  document.querySelectorAll(".menu-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      el.cmdModal?.classList.add("hidden");
      if (action === "new") resetChat();
      if (action === "teach") openTeach();
      if (action === "artifact") setArtifactOpen(el.artifactPanel.classList.contains("hidden"));
      if (action === "theme") {
        const root = document.documentElement;
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
      }
    });
  });

  // Envío del formulario
  el.chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSendMessage(el.promptInput.value);
  });

  el.promptInput?.addEventListener("input", () => {
    el.promptInput.style.height = "auto";
    el.promptInput.style.height = `${Math.min(el.promptInput.scrollHeight, 160)}px`;
  });

  renderMemoryFeed();
  bindQuickPrompts();
})();
