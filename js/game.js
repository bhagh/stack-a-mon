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
  const START_REVEAL_DELAY_MS = 1100;
  const POINTS_BASE = 100;
  const POINTS_SHINY = 50;
  const SHINY_ODDS_DEFAULT = 4096;
  const SHINY_ODDS_DEBUG = 10;
  const DEBUG_TIMER_CLICKS = 5;
  const STREAK_BASE_PERCENT = 10;
  const STREAK_STEP_PERCENT = 5;

  const ladderEl = document.getElementById("ladder");
  const drawAreaEl = document.getElementById("draw-area");
  const timerWrapEl = document.getElementById("timer-wrap");
  const timerEl = document.getElementById("timer");
  const timerValueEl = document.getElementById("timer-value");
  const skipsValueEl = document.getElementById("skips-value");
  const skipsEl = document.getElementById("skips");
  const currentCardEl = document.getElementById("current-card");
  const cardNameEl = document.getElementById("card-name");
  const startBtn = document.getElementById("start-btn");
  const lockBtn = document.getElementById("lock-btn");
  const newGameBtn = document.getElementById("new-game-btn");
  const viewSummaryBtn = document.getElementById("view-summary-btn");
  const preGameControls = document.getElementById("pre-game-controls");
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

  /** @type {{ pokemon: { id: number, name: string, slug: string } | null, shiny: boolean, spriteRevealed: boolean, el: HTMLElement, rowEl: HTMLElement, indexEl: HTMLElement, nameEl: HTMLElement, dexEl: HTMLElement, spriteEl: HTMLImageElement, upBtn: HTMLButtonElement, downBtn: HTMLButtonElement }[]} */
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
  let debugTimerClicks = 0;
  let placementTimeLeft = 0;
  let startToken = 0;
  /** @type {null | { from: number, pointerId: number, startX: number, startY: number, active: boolean, over: number | null, ghost: HTMLElement | null }} */
  let dragState = null;
  let suppressNextSlotClick = false;
  const DRAG_THRESHOLD_PX = 8;

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
    const canSkip = phase === "placing" && skipsLeft > 0 && Boolean(current);
    skipsEl.classList.toggle("skips--action", phase === "placing");
    skipsEl.classList.toggle("skips--disabled", phase === "placing" && !canSkip);
    skipsEl.disabled = phase === "placing" && !canSkip;
    if (phase === "placing") {
      skipsEl.setAttribute(
        "aria-label",
        canSkip
          ? `Skip current Pokémon, ${skipsLeft} skips left`
          : "No skips left"
      );
    } else {
      skipsEl.setAttribute("aria-label", `Skips remaining: ${skipsLeft}`);
    }
  }

  function placingHint() {
    if (skipsLeft <= 0) {
      setStatus("No skips left — place this Pokémon on the ladder.");
      return;
    }
    setStatus("Place on an empty slot, or tap Skips to skip.");
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
    if (phase === "placing") {
      onSkip();
    }
  }

  function onTimerPillClick() {
    if (timerWrapEl.hidden) return;
    debugTimerClicks += 1;
    if (debugTimerClicks < DEBUG_TIMER_CLICKS) return;
    if (shinyOdds === SHINY_ODDS_DEBUG) return;
    shinyOdds = SHINY_ODDS_DEBUG;
    timerEl.classList.add("timer--debug");
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
      const rowWrap = document.createElement("div");
      rowWrap.className = "slot-row";

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "slot-shift slot-shift--down";
      downBtn.setAttribute("aria-label", "Move down");
      downBtn.hidden = true;
      downBtn.textContent = "▼";

      const row = document.createElement("div");
      row.className = "slot";
      row.dataset.index = String(i);

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

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "slot-shift slot-shift--up";
      upBtn.setAttribute("aria-label", "Move up");
      upBtn.hidden = true;
      upBtn.textContent = "▲";

      upBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        shiftSlot(i, -1);
      });
      downBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        shiftSlot(i, 1);
      });
      upBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
      downBtn.addEventListener("pointerdown", (event) => event.stopPropagation());

      row.append(indexEl, spriteEl, nameEl, dexEl);
      row.addEventListener("click", () => onSlotClick(i));
      row.addEventListener("pointerdown", (event) => onSlotPointerDown(i, event));
      row.addEventListener("pointermove", onSlotPointerMove);
      row.addEventListener("pointerup", onSlotPointerUp);
      row.addEventListener("pointercancel", onSlotPointerUp);

      rowWrap.append(downBtn, row, upBtn);
      ladderEl.appendChild(rowWrap);

      slots.push({
        pokemon: null,
        shiny: false,
        spriteRevealed: false,
        el: row,
        rowEl: rowWrap,
        indexEl,
        nameEl,
        dexEl,
        spriteEl,
        upBtn,
        downBtn,
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
    updateShiftControls(index);
  }

  function updateShiftControls(index) {
    const slot = slots[index];
    if (!slot) return;
    const show = phase === "rearrange" && Boolean(slot.pokemon);
    slot.rowEl.classList.toggle("slot-row--rearrange", phase === "rearrange");
    slot.upBtn.hidden = !show;
    slot.downBtn.hidden = !show;
    slot.upBtn.disabled = !show || index <= 0;
    slot.downBtn.disabled = !show || index >= SLOT_COUNT - 1;
  }

  function shiftSlot(index, direction) {
    if (phase !== "rearrange") return;
    const to = index + direction;
    if (to < 0 || to >= SLOT_COUNT) return;
    if (!slots[index]?.pokemon) return;
    movePokemon(index, to);
    setStatus("Moved.", "good");
  }

  function placedCount() {
    return slots.filter((s) => s.pokemon).length;
  }

  function setSlotsInteractive(interactive) {
    slots.forEach((slot, i) => {
      const canUse = interactive;
      slot.el.classList.toggle("slot--interactive", canUse);
      slot.el.classList.toggle("slot--draggable", canUse && phase === "rearrange");
      slot.el.classList.toggle("slot--disabled", !canUse);
      slot.el.setAttribute("aria-disabled", canUse ? "false" : "true");
      updateShiftControls(i);
    });
  }

  function clearDragVisuals() {
    slots.forEach((slot) => {
      slot.el.classList.remove("slot--dragging", "slot--drag-over");
    });
    if (dragState?.ghost) {
      dragState.ghost.remove();
      dragState.ghost = null;
    }
  }

  function moveDragGhost(clientX, clientY) {
    if (!dragState?.ghost) return;
    dragState.ghost.style.left = `${clientX}px`;
    dragState.ghost.style.top = `${clientY}px`;
  }

  function slotIndexFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const btn = el.closest(".slot");
    if (!btn) return null;
    const idx = Number(btn.dataset.index);
    return Number.isInteger(idx) ? idx : null;
  }

  function beginSlotDrag(event) {
    if (!dragState) return;
    const slot = slots[dragState.from];
    if (!slot?.pokemon) return;

    dragState.active = true;
    suppressNextSlotClick = true;
    selectedSlot = null;
    slots.forEach((_, i) => renderSlot(i));

    slot.el.classList.add("slot--dragging");

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.textContent = slot.pokemon.name;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    moveDragGhost(event.clientX, event.clientY);
    setStatus(`Moving ${slot.pokemon.name}…`);
  }

  function updateSlotDrag(event) {
    if (!dragState?.active) return;
    moveDragGhost(event.clientX, event.clientY);

    const over = slotIndexFromPoint(event.clientX, event.clientY);
    if (dragState.over !== null && dragState.over !== over) {
      slots[dragState.over]?.el.classList.remove("slot--drag-over");
    }

    if (over !== null && over !== dragState.from) {
      slots[over].el.classList.add("slot--drag-over");
      dragState.over = over;
    } else {
      dragState.over = null;
    }
  }

  function movePokemon(from, to) {
    if (from === to) return;
    const order = slots.map((s) => ({
      pokemon: s.pokemon,
      shiny: s.shiny,
      spriteRevealed: s.spriteRevealed,
    }));
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    order.forEach((entry, i) => {
      slots[i].pokemon = entry.pokemon;
      slots[i].shiny = entry.shiny;
      slots[i].spriteRevealed = entry.spriteRevealed;
    });
    selectedSlot = null;
    slots.forEach((_, i) => renderSlot(i, { animate: true }));
  }

  function onSlotPointerDown(index, event) {
    if (phase !== "rearrange") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const slot = slots[index];
    if (!slot?.pokemon) return;

    // Prevent mobile text selection / callout while dragging ladder names.
    if (event.pointerType !== "mouse") {
      event.preventDefault();
      const selection = window.getSelection?.();
      if (selection && selection.removeAllRanges) selection.removeAllRanges();
    }

    dragState = {
      from: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      over: null,
      ghost: null,
    };
    slot.el.setPointerCapture(event.pointerId);
  }

  function onSlotPointerMove(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (!dragState.active) {
      const dist = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY
      );
      if (dist < DRAG_THRESHOLD_PX) return;
      beginSlotDrag(event);
    }

    event.preventDefault();
    updateSlotDrag(event);
  }

  function onSlotPointerUp(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const state = dragState;
    const wasActive = state.active;
    const from = state.from;
    clearDragVisuals();
    dragState = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* already released */
    }

    if (!wasActive) return;

    const to = slotIndexFromPoint(event.clientX, event.clientY);
    if (to !== null && to !== from) {
      movePokemon(from, to);
      setStatus("Moved.", "good");
    } else {
      setStatus("Drag onto another slot, or tap two to swap.");
    }
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
    const showPlayHud =
      phase === "placing" ||
      phase === "rearrange-intro" ||
      phase === "rearrange";
    const showCard = phase === "placing";
    const hideCard = !showCard;

    preGameControls.hidden = phase !== "idle";
    rearrangeControls.hidden = phase !== "rearrange";
    postGameControls.hidden = phase !== "done";

    timerWrapEl.hidden = !showPlayHud;
    skipsEl.hidden = !showPlayHud;
    drawAreaEl.classList.toggle("draw-area--play", showPlayHud);

    currentCardEl.hidden = hideCard;
    currentCardEl.classList.toggle("card--hidden", hideCard);
  }

  function onSlotClick(index) {
    if (phase === "placing") {
      placePokemon(index);
      return;
    }
    if (phase === "rearrange") {
      if (suppressNextSlotClick) {
        suppressNextSlotClick = false;
        return;
      }
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
      setStatus("Drag to reorder, or tap two to swap.");
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
    placementTimeLeft = Math.max(0, secondsLeft);
    stopTimer();
    clearBannerTimer();
    secondsLeft = REARRANGE_SECONDS;
    updateTimerDisplay();
    updateCurrentCard();
    setSlotsInteractive(false);
    slots.forEach((_, i) => renderSlot(i));
    showControlsForPhase();
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
    setStatus("Drag, tap two to swap, or use the arrows.");
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

  function longestCorrectStreak(correctFlags) {
    let best = 0;
    let run = 0;
    correctFlags.forEach((ok) => {
      if (ok) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    });
    return best;
  }

  function streakBonusPercent(streakLength, perfect) {
    if (perfect) return 100;
    if (streakLength < 2) return 0;
    return STREAK_BASE_PERCENT + (streakLength - 2) * STREAK_STEP_PERCENT;
  }

  function scoreResult() {
    const ordered = correctOrder();
    const expected = expectedForSlots(ordered);
    let correct = 0;
    let slotTotal = 0;
    let shinyCount = 0;
    const details = [];
    const correctFlags = [];

    slots.forEach((slot, i) => {
      const pokemon = slot.pokemon;
      const expect = expected[i];
      const isCorrect = Boolean(pokemon && expect && pokemon.id === expect.id);
      const shiny = Boolean(slot.shiny);
      correctFlags.push(isCorrect);

      if (!pokemon) return;

      if (shiny) shinyCount += 1;

      let basePoints = isCorrect ? POINTS_BASE : 0;
      let shinyPoints = shiny ? POINTS_SHINY : 0;
      if (isCorrect) correct += 1;
      if (isCorrect && shiny) {
        basePoints *= 2;
        shinyPoints *= 2;
      }
      const slotPoints = basePoints + shinyPoints;

      slotTotal += slotPoints;

      const star = shiny ? " ★" : "";
      details.push({
        label: `${pokemon.name} (#${pokemon.id})${star}`,
        value: slotPoints,
        slotPoints,
        basePoints,
        shinyPoints,
        correct: isCorrect,
        shiny,
      });
    });

    const perfect = correct === SLOT_COUNT && placedCount() === SLOT_COUNT;
    const streakLength = longestCorrectStreak(correctFlags);
    const streakPercent = streakBonusPercent(streakLength, perfect);
    const timeBonus = Math.floor(placementTimeLeft);
    const afterTime = slotTotal + timeBonus;
    const streakBonus = Math.round((afterTime * streakPercent) / 100);
    const score = afterTime + streakBonus;

    return {
      ordered,
      expected,
      correct,
      slotTotal,
      baseScore: slotTotal,
      streakLength,
      streakPercent,
      streakBonus,
      timeBonus,
      afterTime,
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
    clearDragVisuals();
    dragState = null;
    stopTimer();
    setSlotsInteractive(false);
    showControlsForPhase();
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
      if (line.section) classes.push("score-breakdown__section");
      if (line.kind === "correct") classes.push("score-breakdown__correct");
      if (line.kind === "wrong") classes.push("score-breakdown__wrong");
      if (line.kind === "slot") classes.push("score-breakdown__slot");
      if (classes.length) li.className = classes.join(" ");

      const label = document.createElement("span");
      label.textContent = line.label;

      const value = document.createElement("span");
      value.className = "score-breakdown__value";
      if (line.valueHtml) {
        value.innerHTML = line.valueHtml;
      } else {
        value.textContent = String(line.value);
      }

      li.append(label, value);
      scoreBreakdownEl.appendChild(li);
    });
  }

  function formatSlotScoreValue(detail) {
    const parts = [];
    if (detail.basePoints > 0) {
      parts.push(`+${detail.basePoints}`);
    }
    if (detail.shinyPoints > 0) {
      parts.push(`<span class="score-breakdown__shiny">+${detail.shinyPoints}</span>`);
    }
    if (!parts.length) return "0";
    return parts.join(" ");
  }

  function finishGame(result) {
    phase = "done";
    lastScore = result.score;
    showControlsForPhase();

    /** @type {{ label: string, value: string | number, total?: boolean, section?: boolean, kind?: string }[]} */
    const lines = [];

    result.details.forEach((detail) => {
      const name = detail.label.replace(" ★", "");
      const doubled = detail.shiny && detail.correct ? " ★×2" : detail.shiny ? " ★" : "";
      lines.push({
        label: `${name}${doubled}`,
        value: detail.slotPoints,
        valueHtml: formatSlotScoreValue(detail),
        kind: detail.correct ? "correct" : "wrong",
      });
    });

    lines.push({
      label: `Time Bonus (${result.timeBonus}s)`,
      value: `+${result.timeBonus}`,
      section: true,
      kind: result.timeBonus > 0 ? "correct" : "",
    });

    lines.push({
      label:
        result.streakPercent > 0
          ? `Streak ×${result.streakLength} (+${result.streakPercent}%)`
          : "Streak",
      value: result.streakBonus > 0 ? `+${result.streakBonus}` : "+0",
      kind: result.streakBonus > 0 ? "correct" : "",
    });

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
    const streakNote =
      result.streakLength >= 2
        ? ` · streak ${result.streakLength}`
        : "";
    overlayDetailEl.textContent = `${result.correct} of ${SLOT_COUNT} in the right order${shinyNote}${streakNote}`;
    renderBreakdown(lines);
    finalScoreEl.hidden = true;
    overlayEl.hidden = false;

    setStatus(
      result.perfect
        ? "Perfect board — 100% streak bonus!"
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
    startToken += 1;
    stopTimer();
    clearBannerTimer();
    clearDragVisuals();
    dragState = null;
    suppressNextSlotClick = false;
    phaseBannerEl.classList.remove("phase-banner--show");
    phaseBannerEl.hidden = true;
    phase = "idle";
    selectedSlot = null;
    current = null;
    secondsLeft = START_SECONDS;
    skipsLeft = MAX_SKIPS;
    lastScore = null;
    lastResult = null;
    placementTimeLeft = 0;
    deck = shuffle(allPokemon);

    buildLadder();
    updateTimerDisplay();
    updateSkipsDisplay();
    updateCurrentCard();
    setSlotsInteractive(false);
    showControlsForPhase();

    startBtn.disabled = allPokemon.length === 0;
    overlayEl.hidden = true;
    helpOverlayEl.hidden = true;
    finalScoreEl.hidden = true;
    finalScoreEl.textContent = "";
    timerEl.classList.remove("timer--low", "timer--flash-good", "timer--flash-bad");
    setStatus(allPokemon.length ? "" : "Pokémon data failed to load.", "bad");
  }

  async function startGame() {
    if (allPokemon.length === 0) return;
    resetBoard();
    const runToken = ++startToken;
    phase = "placing";
    showControlsForPhase();
    setSlotsInteractive(false);
    current = null;
    updateCurrentCard();
    updateSkipsDisplay();
    setStatus("");

    await wait(START_REVEAL_DELAY_MS);
    if (runToken !== startToken || phase !== "placing") return;

    setSlotsInteractive(true);
    drawNext();
    startTimer(() => endIncomplete());
    placingHint();
  }

  function openHelp() {
    if ((phase === "placing" || phase === "rearrange") && timerId !== null) {
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
  lockBtn.addEventListener("click", lockIn);
  newGameBtn.addEventListener("click", resetBoard);
  viewSummaryBtn.addEventListener("click", openSummary);
  closeBtn.addEventListener("click", closeOverlay);
  helpBtn.addEventListener("click", openHelp);
  helpCloseBtn.addEventListener("click", closeHelp);
  skipsEl.addEventListener("click", onSkipsPillClick);
  timerEl.addEventListener("click", onTimerPillClick);

  resetBoard();
})();
