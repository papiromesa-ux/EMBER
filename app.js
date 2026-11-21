/* ==========================================================================
   SPARK.IA — LÓGICA DE INTERFAZ Y CONEXIÓN AL MOTOR GO
   Regla estricta: 0 emojis.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Referencias del DOM
  const htmlEl = document.documentElement;
  const sidebar = document.getElementById("sidebar");
  const btnToggleSidebar = document.getElementById("btnToggleSidebar");
  const btnNewChat = document.getElementById("btnNewChat");
  const modeItems = document.querySelectorAll(".mode-item");
  const currentModeLabel = document.getElementById("currentModeLabel");
  const memoryFeed = document.getElementById("memoryFeed");
  const statusText = document.getElementById("statusText");

  const btnCommandPalette = document.getElementById("btnCommandPalette");
  const btnToggleArtifact = document.getElementById("btnToggleArtifact");
  const btnThemeToggle = document.getElementById("btnThemeToggle");

  const chatStream = document.getElementById("chatStream");
  const promptInput = document.getElementById("promptInput");
  const btnSend = document.getElementById("btnSend");
  const toolTags = document.querySelectorAll(".tool-tag");

  const artifactPanel = document.getElementById("artifactPanel");
  const artifactTitle = document.getElementById("artifactTitle");
  const artifactCode = document.getElementById("artifactCode");
  const btnCopyCode = document.getElementById("btnCopyCode");
  const btnCloseArtifact = document.getElementById("btnCloseArtifact");

  const teachModal = document.getElementById("teachModal");
  const btnOpenTeach = document.getElementById("btnOpenTeach");
  const btnCloseTeach = document.getElementById("btnCloseTeach");
  const btnCancelTeach = document.getElementById("btnCancelTeach");
  const btnSaveTeach = document.getElementById("btnSaveTeach");
  const teachTema = document.getElementById("teachTema");
  const teachDato = document.getElementById("teachDato");
  const teachPersona = document.getElementById("teachPersona");

  const cmdModal = document.getElementById("cmdModal");
  const cmdSearch = document.getElementById("cmdSearch");
  const cmdOptions = document.querySelectorAll(".cmd-option");

  // Estado de la aplicación
  let activeMode = "general";
  let sessionMemory = JSON.parse(localStorage.getItem("spark_memory") || "[]");
  const initialHeroHTML = chatStream.innerHTML;

  // Inicializar memoria en barra lateral
  renderMemoryFeed();

  // ========================================================================
  // 1. GESTIÓN DE TEMA (FUEGO OSCURO / BLANCO LIMPIO)
  // ========================================================================
  function toggleTheme() {
    const current = htmlEl.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", next);
    localStorage.setItem("spark_theme", next);
  }

  const savedTheme = localStorage.getItem("spark_theme");
  if (savedTheme) {
    htmlEl.setAttribute("data-theme", savedTheme);
  }

  btnThemeToggle.addEventListener("click", toggleTheme);

  // ========================================================================
  // 2. BARRA LATERAL Y MODOS DEL ECOSISTEMA
  // ========================================================================
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  modeItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeItems.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      activeMode = btn.getAttribute("data-mode");
      currentModeLabel.textContent = activeMode;
    });
  });

  // ========================================================================
  // 3. PANEL DE CÓDIGO / ARTEFACTO (ESTILO CLAUDE)
  // ========================================================================
  function toggleArtifact(forceOpen = null) {
    if (forceOpen === true) {
      artifactPanel.classList.remove("hidden");
    } else if (forceOpen === false) {
      artifactPanel.classList.add("hidden");
    } else {
      artifactPanel.classList.toggle("hidden");
    }
  }

  btnToggleArtifact.addEventListener("click", () => toggleArtifact());
  btnCloseArtifact.addEventListener("click", () => toggleArtifact(false));

  btnCopyCode.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(artifactCode.textContent);
      const prev = btnCopyCode.textContent;
      btnCopyCode.textContent = "Copiado";
      setTimeout(() => (btnCopyCode.textContent = prev), 1500);
    } catch (_) {
      btnCopyCode.textContent = "Error";
    }
  });

  function showCodeInArtifact(title, code) {
    artifactTitle.textContent = title;
    artifactCode.textContent = code;
    toggleArtifact(true);
  }

  // ========================================================================
  // 4. CHAT, COMPOSITOR Y MOTOR DE RESPUESTA
  // ========================================================================
  function resetSession() {
    chatStream.innerHTML = initialHeroHTML;
    bindQuickChips();
    promptInput.value = "";
    autoResizeTextarea();
  }

  btnNewChat.addEventListener("click", resetSession);

  function autoResizeTextarea() {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + "px";
  }

  promptInput.addEventListener("input", autoResizeTextarea);

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  btnSend.addEventListener("click", handleSendMessage);

  // Etiquetas de inserción rápida (!stil, ~zeit, Ripetox, SitMoB)
  toolTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const snippet = tag.getAttribute("data-insert").replace("\\n", "\n");
      const start = promptInput.selectionStart;
      const end = promptInput.selectionEnd;
      const val = promptInput.value;
      promptInput.value = val.substring(0, start) + snippet + val.substring(end);
      promptInput.focus();
      promptInput.selectionStart = promptInput.selectionEnd = start + snippet.length;
      autoResizeTextarea();
    });
  });

  function bindQuickChips() {
    document.querySelectorAll(".chip-fire").forEach((chip) => {
      chip.addEventListener("click", () => {
        promptInput.value = chip.getAttribute("data-prompt");
        handleSendMessage();
      });
    });
  }
  bindQuickChips();

  function appendMessage(role, text) {
    const hero = chatStream.querySelector(".welcome-hero");
    if (hero) hero.remove();

    const row = document.createElement("div");
    row.className = `msg-row ${role}`;

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.textContent = role === "user" ? `TÚ // ${activeMode.toUpperCase()}` : "SPARK.IA // NÚCLEO";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;

    row.appendChild(meta);
    row.appendChild(bubble);
    chatStream.appendChild(row);
    chatStream.scrollTop = chatStream.scrollHeight;
  }

  async function handleSendMessage() {
    const text = promptInput.value.trim();
    if (!text) return;

    appendMessage("user", text);
    promptInput.value = "";
    autoResizeTextarea();

    // Intentar conectar con el backend Go (server.go)
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode: activeMode })
      });

      if (!response.ok) throw new Error("Servidor Go no disponible");

      const data = await response.json();
      appendMessage("assistant", data.reply);
      if (data.artifactCode) {
        showCodeInArtifact(data.artifactTitle || "salida.fm", data.artifactCode);
      }
      statusText.textContent = "Motor Go Conectado";
    } catch (_) {
      // Modo autónomo local mientras server.go no esté ejecutándose
      statusText.textContent = "Modo Local Autónomo";
      const localResult = processLocalEngine(text, activeMode);
      appendMessage("assistant", localResult.reply);
      if (localResult.code) {
        showCodeInArtifact(localResult.title, localResult.code);
      }
    }
  }

  // Procesador local de respaldo (cálculos ~zeit, memoria aprendida y plantillas)
  function processLocalEngine(input, mode) {
    const lower = input.toLowerCase();

    // 1. Buscar en memoria enseñada
    const learned = sessionMemory.find((item) =>
      lower.includes(item.tema.toLowerCase())
    );
    if (learned) {
      return {
        reply: `[MemoriaSpark // ${learned.tema}]\n${learned.dato}\n(Aportado por: ${learned.persona})`
      };
    }

    // 2. Cálculo rápido de ~zeit y Ripetox (ej. 250.ms * Ripetox=8)
    const timeMatch = input.match(/(\d+(?:\.\d+)?)\s*\.(ms|s|m)\s*\*\s*ripetox\s*=\s*(\d+)/i);
    if (timeMatch) {
      const val = parseFloat(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const rep = parseInt(timeMatch[3], 10);
      const total = val * rep;
      const inSeconds = unit === "ms" ? total / 1000 : unit === "m" ? total * 60 : total;
      return {
        reply: `Cálculo de ciclo FLAME:\nBase: ${val}.${unit} x ${rep} repeticiones = ${total}.${unit}\nEquivalente exacto en segundos: ${inSeconds}s`
      };
    }

    // 3. Plantilla FLAME / JS / Rust
    if (lower.includes("plantilla") || mode === "flamedash" || mode === "flamecode") {
      const sampleCode = `!stil flamedash\n~zeit=250.ms\nRipetox=8\n\n// Módulo de ejecución sincronizada\nbloque principal {\n  estado: "activo"\n  umbral: 100\n}`;
      return {
        reply: `He generado la estructura base en el panel lateral derecho (salida.fm) bajo el perfil ${mode}.`,
opt.addEventListener("click", () => {
const action = opt.getAttribute("data-action");
closeCmdModal();
executeCommandAction(action);
});
});
function executeCommandAction(action) {
if (action === "new") resetSession();
if (action === "teach") openTeachModal();
if (action === "artifact") toggleArtifact();
if (action === "theme") toggleTheme();
}
document.addEventListener("keydown", (e) => {
if (e.key === "Escape") {
closeCmdModal();
closeTeachModal();
}
if (e.ctrlKey || e.metaKey) {
const key = e.key.toLowerCase();
if (key === "k") {
e.preventDefault();
cmdModal.classList.contains("hidden") ? openCmdModal() : closeCmdModal();
} else if (key === "b") {
e.preventDefault();
sidebar.classList.toggle("collapsed");
} else if (key === "n") {
e.preventDefault();
resetSession();
} else if (key === "e") {
e.preventDefault();
openTeachModal();
} else if (key === "i") {
e.preventDefault();
toggleArtifact();
} else if (key === "j") {
e.preventDefault();
toggleTheme();
}
}
});
});
