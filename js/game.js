(() => {
  const SLOT_COUNT = 10;
  const START_SECONDS = 60;
  const REARRANGE_SECONDS = 15;
  const MAX_SKIPS = 3;
  const REVEAL_PAUSE_MS = 900;
  const REVEAL_STAGGER_MS = 500;
  const SPRITE_REVEAL_MS = 420;
  const SHINY_BANNER_MS = 2400;
  const REARRANGE_BANNER_MS = 2400;
  const POINTS_BASE = 100;
  const SHINY_ODDS_DEFAULT = 4096;
  const SHINY_ODDS_DEBUG = 10;
  const SHINY_BONUS = 100;
  const DEBUG_SKIP_CLICKS = 3;

  const ladderEl = document.getElementById("ladder");
  const timerEl = document.getElementById("timer");
  const timerValueEl = document.getElementById("timer-value");
  const skipsValueEl = document.getElementById("skips-value");
  const skipsEl = document.getElementById("skips");
  const currentCardEl = document.getElementById("current-card");
  const cardNameEl = document.getElementById("card-name");
  const phaseLabelEl = document.getElementById("phase-label");
  const startBtn = document.getElementById("start-btn");
  const skipBtn = document.getElementById("skip-btn");
  const lockBtn = document.getElementById("lock-btn");
  const newGameBtn = document.getElementById("new-game-btn");
  const viewSummaryBtn = document.getElementById("view-summary-btn");
  const preGameControls = document.getElementById("pre-game-controls");
  const playControls = document.getElementById("play-controls");
  const rearrangeControls = document.getElementById("rearrange-controls");
  const postGameControls = document.getElementById("post-game-controls");
  const statusEl = document.getElementById("status");
  const finalScoreEl = document.getElementById("final-score");
  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayScoreEl = document.getElementById("overlay-score");
  const overlayDetailEl = document.getElementById("overlay-detail");
  const scoreBreakdownEl = document.getElementById("score-breakdown");
  const closeBtn = document.getElementById("close-btn");
  const helpBtn = document.getElementById("help-btn");
  const helpOverlayEl = document.getElementById("help-overlay");
  const helpCloseBtn = document.getElementById("help-close-btn");
  const buildVersionEl = document.getElementById("build-version");
  const phaseBannerEl = document.getElementById("phase-banner");
  const phaseBannerTitleEl = document.getElementById("phase-banner-title");
  const phaseBannerSubEl = document.getElementById("phase-banner-sub");

  buildVersionEl.textContent = `Version ${window.GAME_VERSION || "0.0.0"}`;

  const allPokemon = Array.isArray(window.POKEMON) ? window.POKEMON : [];

  /** @type {{ pokemon: { id: number, name: string, slug: string } | null, shiny: boolean, spriteRevealed: boolean, el: HTMLButtonElement, indexEl: HTMLElement, nameEl: HTMLElement, dexEl: HTMLElement, spriteEl: HTMLImageElement }[]} */
  let slots = [];
  /** @type {{ id: number, name: string, slug: string }[]} */
  let deck = [];
  /** @type {{ id: number, name: string, slug: string } | null} */
  let current = null;
  /** @type {"idle" | "placing" | "rearrange-intro" | "rearrange" | "reveal" | "done"} */
  let phase = "idle";
  let secondsLeft = START_SECONDS;
  let skipsLeft = MAX_SKIPS;
  let selectedSlot = null;
  let timerId = null;
  let bannerTimerId = null;
  let lastScore = null;
  let lastResult = null;
  let helpPaused = false;
  let shinyOdds = SHINY_ODDS_DEFAULT;
  let skipDebugClicks = 0;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatTime(totalSeconds) {
    const tenths = Math.floor(Math.max(0, totalSeconds) * 10) / 10;
    return tenths.toFixed(1);
  }

  function setStatus(message, kind = "") {
    statusEl.textContent = message;
    statusEl.className = "status" + (kind ? ` status--${kind}` : "");
  }

  function updateTimerDisplay() {
    timerValueEl.textContent = formatTime(secondsLeft);
    const low =
      (phase === "placing" || phase === "rearrange") && secondsLeft <= 10;
    timerEl.classList.toggle("timer--low", low);
  }

  function updateSkipsDisplay() {
    skipsValueEl.textContent = String(skipsLeft);
    skipBtn.disabled = phase !== "placing" || skipsLeft <= 0 || !current;
  }

  function placingHint() {
    if (skipsLeft <= 0) {
      setStatus("No skips left — place this Pokémon on the ladder.");
      return;
    }
    setStatus("Place on an empty slot, or skip.");
  }

  function flashTimer(kind) {
    timerEl.classList.remove("timer--flash-good", "timer--flash-bad");
    void timerEl.offsetWidth;
    timerEl.classList.add(kind === "good" ? "timer--flash-good" : "timer--flash-bad");
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function clearBannerTimer() {
    if (bannerTimerId !== null) {
      clearTimeout(bannerTimerId);
      bannerTimerId = null;
    }
  }

  function hidePhaseBanner() {
    phaseBannerEl.classList.remove("phase-banner--show");
    window.setTimeout(() => {
      if (!phaseBannerEl.classList.contains("phase-banner--show")) {
        phaseBannerEl.hidden = true;
      }
    }, 450);
  }

  function showPhaseBanner(title, sub) {
    phaseBannerTitleEl.textContent = title;
    phaseBannerSubEl.textContent = sub;
    phaseBannerEl.hidden = false;
    void phaseBannerEl.offsetWidth;
    phaseBannerEl.classList.add("phase-banner--show");
  }

  function startTimer(onExpire) {
    stopTimer();
    const startedAt = performance.now();
    let elapsed = 0;

    timerId = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - startedAt) / 1000 - elapsed;
      elapsed += delta;
      secondsLeft -= delta;
      updateTimerDisplay();
      if (secondsLeft <= 0) {
        secondsLeft = 0;
        updateTimerDisplay();
        stopTimer();
        onExpire();
      }
    }, 100);
  }

  function rollShiny() {
    return Math.floor(Math.random() * shinyOdds) === 0;
  }

  function onSkipsPillClick() {
    if (phase !== "idle") return;
    skipDebugClicks += 1;
    if (skipDebugClicks < DEBUG_SKIP_CLICKS) return;
    if (shinyOdds === SHINY_ODDS_DEBUG) return;
    shinyOdds = SHINY_ODDS_DEBUG;
    skipsEl.classList.add("skips--debug");
  }

  function spritePath(id, shiny) {
    return shiny
      ? `assets/sprites/shiny/${id}.png`
      : `assets/sprites/${id}.png`;
  }

  function showPhaseBannerTimed(title, sub, holdMs) {
    return new Promise((resolve) => {
      clearBannerTimer();
      showPhaseBanner(title, sub);
      bannerTimerId = window.setTimeout(() => {
        bannerTimerId = null;
        hidePhaseBanner();
        window.setTimeout(resolve, 450);
      }, holdMs);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function buildLadder() {
    ladderEl.innerHTML = "";
    slots = [];

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot";
      btn.disabled = true;
      btn.dataset.index = String(i);

      const indexEl = document.createElement("span");
      indexEl.className = "slot-index";
      indexEl.textContent = String(SLOT_COUNT - i);
      indexEl.setAttribute("aria-hidden", "true");

      const spriteEl = document.createElement("img");
      spriteEl.className = "slot-sprite";
      spriteEl.alt = "";
      spriteEl.decoding = "async";
      spriteEl.setAttribute("aria-hidden", "true");

      const nameEl = document.createElement("span");
      nameEl.className = "slot-name";
      nameEl.textContent = "";

      const dexEl = document.createElement("span");
      dexEl.className = "slot-dex";
      dexEl.setAttribute("aria-hidden", "true");

      btn.append(indexEl, spriteEl, nameEl, dexEl);
      btn.addEventListener("click", () => onSlotClick(i));
      ladderEl.appendChild(btn);

      slots.push({
        pokemon: null,
        shiny: false,
        spriteRevealed: false,
        el: btn,
        indexEl,
        nameEl,
        dexEl,
        spriteEl,
      });
      updateSlotAria(i);
    }
  }

  function updateSlotAria(index) {
    const slot = slots[index];
    if (!slot) return;
    if (!slot.pokemon) {
      slot.el.setAttribute(
        "aria-label",
        `Empty slot ${SLOT_COUNT - index} of ${SLOT_COUNT}`
      );
      return;
    }
    const shinyLabel = slot.shiny && slot.spriteRevealed ? ", shiny" : "";
    slot.el.setAttribute(
      "aria-label",
      `${slot.pokemon.name}${shinyLabel}, slot ${SLOT_COUNT - index} of ${SLOT_COUNT}`
    );
  }

  function renderSlot(index, { animate = false } = {}) {
    const slot = slots[index];
    if (!slot) return;

    const filled = Boolean(slot.pokemon);
    slot.el.classList.toggle("slot--filled", filled);
    slot.el.classList.toggle("slot--selected", selectedSlot === index);
    slot.el.classList.toggle(
      "slot--shiny",
      Boolean(slot.shiny && slot.spriteRevealed)
    );
    slot.el.classList.remove("slot--correct", "slot--wrong", "slot--place");
    slot.dexEl.classList.remove("slot-dex--show");
    slot.dexEl.textContent = "";
    slot.indexEl.hidden = filled;

    if (slot.pokemon) {
      slot.nameEl.textContent = slot.pokemon.name;
      if (slot.spriteRevealed) {
        slot.spriteEl.src = spritePath(slot.pokemon.id, slot.shiny);
        slot.spriteEl.classList.add("slot-sprite--show");
      } else {
        slot.spriteEl.removeAttribute("src");
        slot.spriteEl.classList.remove("slot-sprite--show");
      }
      if (animate) {
        void slot.el.offsetWidth;
        slot.el.classList.add("slot--place");
        window.setTimeout(() => slot.el.classList.remove("slot--place"), 400);
      }
    } else {
      slot.nameEl.textContent = "";
      slot.shiny = false;
      slot.spriteRevealed = false;
      slot.spriteEl.removeAttribute("src");
      slot.spriteEl.classList.remove("slot-sprite--show");
      slot.el.classList.remove("slot--shiny");
    }

    updateSlotAria(index);
  }

  function placedCount() {
    return slots.filter((s) => s.pokemon).length;
  }

  function setSlotsInteractive(interactive) {
    slots.forEach((slot) => {
      const canUse = interactive;
      slot.el.disabled = !canUse;
      slot.el.classList.toggle("slot--interactive", canUse);
    });
  }

  function updateCurrentCard() {
    if (!current || phase !== "placing") {
      currentCardEl.classList.add("card--face-down");
      currentCardEl.classList.remove("card--face-up");
      cardNameEl.textContent = "?";
      return;
    }

    currentCardEl.classList.remove("card--face-down");
    currentCardEl.classList.add("card--face-up");
    cardNameEl.textContent = current.name;
  }

  function drawNext() {
    if (deck.length === 0) {
      current = null;
      updateCurrentCard();
      setStatus("No Pokémon left to draw.", "bad");
      return;
    }

    current = deck.pop();
    currentCardEl.classList.remove("card--face-up");
    void currentCardEl.offsetWidth;
    updateCurrentCard();
    updateSkipsDisplay();
  }

  function showControlsForPhase() {
    preGameControls.hidden = phase !== "idle";
    playControls.hidden = phase !== "placing";
    rearrangeControls.hidden = phase !== "rearrange";
    postGameControls.hidden = phase !== "done";
    currentCardEl.classList.toggle(
      "card--hidden",
      phase === "rearrange-intro" ||
        phase === "rearrange" ||
        phase === "reveal"
    );
  }

  function onSlotClick(index) {
    if (phase === "placing") {
      placePokemon(index);
      return;
    }
    if (phase === "rearrange") {
      rearrangeTap(index);
    }
  }

  function placePokemon(index) {
    if (phase !== "placing" || !current) return;
    const slot = slots[index];
    if (!slot || slot.pokemon) {
      setStatus("That slot is already filled.", "bad");
      return;
    }

    slot.pokemon = current;
    slot.shiny = rollShiny();
    slot.spriteRevealed = false;
    current = null;
    renderSlot(index, { animate: true });
    flashTimer("good");
    updateCurrentCard();

    if (placedCount() >= SLOT_COUNT) {
      beginRearrange();
      return;
    }

    drawNext();
    placingHint();
  }

  function onSkip() {
    if (phase !== "placing" || !current || skipsLeft <= 0) {
      if (phase === "placing" && skipsLeft <= 0 && current) {
        placingHint();
      }
      return;
    }
    skipsLeft -= 1;
    updateSkipsDisplay();
    setStatus(`Skipped ${current.name}.`);
    drawNext();
    if (phase === "placing" && current) {
      placingHint();
    }
  }

  function rearrangeTap(index) {
    const slot = slots[index];
    if (!slot || !slot.pokemon) return;

    if (selectedSlot === null) {
      selectedSlot = index;
      renderSlot(index);
      setStatus(`Selected ${slot.pokemon.name}. Tap another to swap.`);
      return;
    }

    if (selectedSlot === index) {
      selectedSlot = null;
      renderSlot(index);
      setStatus("Tap a Pokémon, then another to swap.");
      return;
    }

    const other = selectedSlot;
    const tempPokemon = slots[other].pokemon;
    const tempShiny = slots[other].shiny;
    slots[other].pokemon = slot.pokemon;
    slots[other].shiny = slot.shiny;
    slot.pokemon = tempPokemon;
    slot.shiny = tempShiny;
    selectedSlot = null;
    renderSlot(other, { animate: true });
    renderSlot(index, { animate: true });
    setStatus("Swapped.", "good");
  }

  function beginRearrange() {
    phase = "rearrange-intro";
    selectedSlot = null;
    current = null;
    stopTimer();
    clearBannerTimer();
    secondsLeft = REARRANGE_SECONDS;
    updateTimerDisplay();
    updateCurrentCard();
    setSlotsInteractive(false);
    slots.forEach((_, i) => renderSlot(i));
    showControlsForPhase();
    phaseLabelEl.textContent = "Get ready";
    setStatus("");

    showPhaseBanner("Final 15 seconds", "Rearrange your stack");

    bannerTimerId = window.setTimeout(() => {
      bannerTimerId = null;
      hidePhaseBanner();
      window.setTimeout(() => {
        if (phase !== "rearrange-intro") return;
        startRearrangeTimer();
      }, 450);
    }, REARRANGE_BANNER_MS);
  }

  function startRearrangeTimer() {
    phase = "rearrange";
    secondsLeft = REARRANGE_SECONDS;
    updateTimerDisplay();
    setSlotsInteractive(true);
    showControlsForPhase();
    phaseLabelEl.textContent = "Rearrange";
    setStatus("Swap any two Pokémon, then lock in.");
    startTimer(() => lockIn());
  }

  function correctOrder() {
    return [...slots]
      .map((s) => s.pokemon)
      .filter(Boolean)
      .sort((a, b) => a.id - b.id);
  }

  /**
   * Ladder is top→bottom visually (index 0 = top = highest).
   * Correct order bottom→top = ascending dex, so visual top = last in ascending list.
   */
  function expectedForSlots(ordered) {
    // ordered ascending (low→high). Visual slots top→bottom should be high→low.
    return [...ordered].reverse();
  }

  function scoreResult() {
    const ordered = correctOrder();
    const expected = expectedForSlots(ordered);
    let correct = 0;
    let baseScore = 0;
    let shinyCount = 0;
    const details = [];

    slots.forEach((slot, i) => {
      const pokemon = slot.pokemon;
      const expect = expected[i];
      const isCorrect = Boolean(pokemon && expect && pokemon.id === expect.id);
      const shiny = Boolean(slot.shiny);

      if (!pokemon) return;

      if (shiny) shinyCount += 1;

      let slotPoints = 0;
      if (isCorrect) {
        correct += 1;
        slotPoints = POINTS_BASE + pokemon.id;
        if (shiny) slotPoints *= 2;
      }

      const shinyBonus = shiny ? SHINY_BONUS : 0;
      const total = slotPoints + shinyBonus;
      baseScore += total;

      const star = shiny ? " ★" : "";
      details.push({
        label: `${pokemon.name} (#${pokemon.id})${star}`,
        value: total,
        slotPoints,
        shinyBonus,
        correct: isCorrect,
        shiny,
      });
    });

    const perfect = correct === SLOT_COUNT && placedCount() === SLOT_COUNT;
    const score = perfect ? baseScore * 2 : baseScore;

    return {
      ordered,
      expected,
      correct,
      baseScore,
      score,
      perfect,
      details,
      shinyCount,
    };
  }

  async function lockIn() {
    if (phase !== "rearrange") return;
    phase = "reveal";
    selectedSlot = null;
    stopTimer();
    setSlotsInteractive(false);
    showControlsForPhase();
    phaseLabelEl.textContent = "Reveal";
    setStatus("");
    slots.forEach((_, i) => renderSlot(i));

    const result = scoreResult();
    lastResult = result;

    await showPhaseBannerTimed(
      "Are there any shiny Pokémon?",
      "Let's find out",
      SHINY_BANNER_MS
    );

    if (phase !== "reveal") return;

    await revealSprites();
    await wait(350);
    await revealDexNumbers(result);
    finishGame(result);
  }

  function revealSprites() {
    return new Promise((resolve) => {
      for (let step = 0; step < SLOT_COUNT; step += 1) {
        const i = SLOT_COUNT - 1 - step;
        const slot = slots[i];

        window.setTimeout(() => {
          if (!slot.pokemon) return;
          slot.spriteRevealed = true;
          slot.spriteEl.src = spritePath(slot.pokemon.id, slot.shiny);
          slot.spriteEl.classList.remove("slot-sprite--show");
          void slot.spriteEl.offsetWidth;
          slot.spriteEl.classList.add("slot-sprite--show");
          slot.el.classList.toggle("slot--shiny", slot.shiny);
          updateSlotAria(i);
        }, step * SPRITE_REVEAL_MS);
      }

      window.setTimeout(
        resolve,
        SPRITE_REVEAL_MS * SLOT_COUNT + 200
      );
    });
  }

  function revealDexNumbers(result) {
    return new Promise((resolve) => {
      for (let step = 0; step < SLOT_COUNT; step += 1) {
        const i = SLOT_COUNT - 1 - step;
        const slot = slots[i];
        const pokemon = slot.pokemon;
        const expect = result.expected[i];
        const isCorrect = Boolean(pokemon && expect && pokemon.id === expect.id);

        window.setTimeout(() => {
          slot.el.classList.remove("slot--selected");
          slot.el.classList.toggle("slot--correct", isCorrect);
          slot.el.classList.toggle("slot--wrong", Boolean(pokemon) && !isCorrect);

          if (pokemon) {
            slot.dexEl.textContent = `#${String(pokemon.id).padStart(3, "0")}`;
            void slot.dexEl.offsetWidth;
            slot.dexEl.classList.add("slot-dex--show");
          }
        }, step * REVEAL_STAGGER_MS);
      }

      window.setTimeout(
        resolve,
        REVEAL_STAGGER_MS * SLOT_COUNT + 400
      );
    });
  }

  function renderBreakdown(lines) {
    scoreBreakdownEl.innerHTML = "";
    lines.forEach((line) => {
      const li = document.createElement("li");
      const classes = [];
      if (line.total) classes.push("score-breakdown__total");
      if (line.kind === "correct") classes.push("score-breakdown__correct");
      if (line.kind === "wrong") classes.push("score-breakdown__wrong");
      if (line.kind === "slot") classes.push("score-breakdown__slot");
      if (classes.length) li.className = classes.join(" ");

      const label = document.createElement("span");
      label.textContent = line.label;

      const value = document.createElement("span");
      value.className = "score-breakdown__value";
      value.textContent = String(line.value);

      li.append(label, value);
      scoreBreakdownEl.appendChild(li);
    });
  }

  function finishGame(result) {
    phase = "done";
    lastScore = result.score;
    showControlsForPhase();
    phaseLabelEl.textContent = "Done";

    /** @type {{ label: string, value: string | number, total?: boolean, kind?: string }[]} */
    const lines = [];

    result.details.forEach((detail) => {
      const name = detail.label.replace(" ★", "");
      const doubled = detail.shiny && detail.correct ? " ×2" : "";
      let value;

      if (detail.slotPoints > 0 && detail.shinyBonus > 0) {
        value = `+${detail.slotPoints} +${detail.shinyBonus}`;
      } else if (detail.shinyBonus > 0) {
        value = `+${detail.shinyBonus}`;
      } else if (detail.slotPoints > 0) {
        value = `+${detail.slotPoints}`;
      } else {
        value = "0";
      }

      lines.push({
        label: `${name}${doubled}`,
        value,
        kind: detail.correct || detail.shinyBonus > 0 ? "correct" : "wrong",
      });
    });

    if (result.perfect) {
      lines.push({
        label: "Perfect bonus (×2)",
        value: `+${result.baseScore}`,
        kind: "correct",
      });
    }

    lines.push({ label: "Total", value: result.score, total: true });

    overlayTitleEl.textContent = result.perfect
      ? "Perfect Stack!"
      : result.shinyCount > 0
        ? "Shiny!"
        : result.correct === 0
          ? "Tough Round"
          : "Results";
    overlayScoreEl.textContent = `${result.score} pts`;
    const shinyNote =
      result.shinyCount > 0
        ? ` · ${result.shinyCount} shiny`
        : "";
    overlayDetailEl.textContent = `${result.correct} of ${SLOT_COUNT} in the right order${shinyNote}`;
    renderBreakdown(lines);
    finalScoreEl.hidden = true;
    overlayEl.hidden = false;

    setStatus(
      result.perfect
        ? "All 10 correct — score doubled!"
        : result.shinyCount > 0
          ? `Shiny Pokémon found: ${result.shinyCount}`
          : "",
      result.perfect || result.shinyCount > 0 ? "good" : ""
    );
  }

  function endIncomplete() {
    if (phase !== "placing") return;
    phase = "done";
    stopTimer();
    setSlotsInteractive(false);
    current = null;
    updateCurrentCard();
    showControlsForPhase();
    phaseLabelEl.textContent = "Done";
    lastScore = 0;
    lastResult = null;

    overlayTitleEl.textContent = "Time's Up";
    overlayScoreEl.textContent = "0 pts";
    overlayDetailEl.textContent = `Only ${placedCount()} of ${SLOT_COUNT} slots filled`;
    renderBreakdown([
      { label: "Incomplete ladder", value: 0 },
      { label: "Total", value: 0, total: true },
    ]);
    finalScoreEl.hidden = true;
    overlayEl.hidden = false;
    setStatus("Fill all 10 slots before time runs out.", "bad");
  }

  function closeOverlay() {
    overlayEl.hidden = true;
    postGameControls.hidden = false;
    if (lastScore !== null) {
      finalScoreEl.hidden = false;
      finalScoreEl.textContent = `Final score: ${lastScore} pts`;
    }
    setStatus("");
  }

  function openSummary() {
    if (lastScore === null) return;
    postGameControls.hidden = true;
    finalScoreEl.hidden = true;
    overlayEl.hidden = false;
  }

  function resetBoard() {
    stopTimer();
    clearBannerTimer();
    phaseBannerEl.classList.remove("phase-banner--show");
    phaseBannerEl.hidden = true;
    phase = "idle";
    selectedSlot = null;
    current = null;
    secondsLeft = START_SECONDS;
    skipsLeft = MAX_SKIPS;
    lastScore = null;
    lastResult = null;
    deck = shuffle(allPokemon);

    buildLadder();
    updateTimerDisplay();
    updateSkipsDisplay();
    updateCurrentCard();
    setSlotsInteractive(false);
    showControlsForPhase();

    startBtn.disabled = allPokemon.length === 0;
    phaseLabelEl.textContent = "Ready";
    overlayEl.hidden = true;
    helpOverlayEl.hidden = true;
    finalScoreEl.hidden = true;
    finalScoreEl.textContent = "";
    timerEl.classList.remove("timer--low", "timer--flash-good", "timer--flash-bad");
    setStatus(allPokemon.length ? "" : "Pokémon data failed to load.", "bad");
  }

  function startGame() {
    if (allPokemon.length === 0) return;
    resetBoard();
    phase = "placing";
    showControlsForPhase();
    phaseLabelEl.textContent = "Place";
    setSlotsInteractive(true);
    startTimer(() => endIncomplete());
    drawNext();
    placingHint();
  }

  function openHelp() {
    if (phase === "placing" || phase === "rearrange") {
      helpPaused = true;
      stopTimer();
    }
    helpOverlayEl.hidden = false;
  }

  function closeHelp() {
    helpOverlayEl.hidden = true;
    if (helpPaused && (phase === "placing" || phase === "rearrange")) {
      helpPaused = false;
      const onExpire = phase === "placing" ? () => endIncomplete() : () => lockIn();
      startTimer(onExpire);
    }
  }

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  startBtn.addEventListener("click", startGame);
  skipBtn.addEventListener("click", onSkip);
  lockBtn.addEventListener("click", lockIn);
  newGameBtn.addEventListener("click", resetBoard);
  viewSummaryBtn.addEventListener("click", openSummary);
  closeBtn.addEventListener("click", closeOverlay);
  helpBtn.addEventListener("click", openHelp);
  helpCloseBtn.addEventListener("click", closeHelp);
  skipsEl.addEventListener("click", onSkipsPillClick);

  resetBoard();
})();
