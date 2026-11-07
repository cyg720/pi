/* Visual select wrapper; the original control remains the form's value source. */
(() => {
  "use strict";
  const controls = new WeakMap();
  let opened = null;
  let serial = 0;
  const chevron = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>';

  function closeMenu(restoreFocus = false) {
    if (!opened) return;
    const { trigger, menu } = opened;
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-activedescendant");
    menu.remove();
    opened = null;
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }

  function sync(control) {
    const { select, trigger, text } = control;
    text.textContent = select.selectedOptions[0]?.textContent || "请选择";
    trigger.disabled = select.disabled || !select.options.length;
    trigger.title = text.textContent;
  }

  function positionMenu() {
    if (!opened) return;
    const { trigger, menu } = opened;
    if (!trigger.isConnected) { closeMenu(); return; }
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const upward = below < Math.min(menu.scrollHeight, 280) && above > below;
    const room = upward ? above : below;
    menu.style.maxHeight = `${Math.max(50, Math.min(280, room))}px`;
    menu.style.width = `${Math.min(Math.max(rect.width, 200), window.innerWidth - 20)}px`;
    menu.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 10))}px`;
    menu.style.top = `${upward ? Math.max(10, rect.top - menu.offsetHeight - 7) : rect.bottom + 7}px`;
  }

  function activate(index) {
    if (!opened) return;
    const { select, trigger, menu } = opened;
    if (!select.options[index] || select.options[index].disabled) return;
    opened.index = index;
    for (const option of menu.children) option.classList.toggle("is-active", Number(option.dataset.index) === index);
    const item = menu.querySelector(`[data-index="${index}"]`);
    trigger.setAttribute("aria-activedescendant", item.id);
    item.scrollIntoView({ block: "nearest" });
  }

  function choose(index) {
    if (!opened) return;
    const control = opened;
    const { select, trigger } = control;
    if (select.options[index]?.disabled) return;
    const changed = select.selectedIndex !== index;
    const formId = select.form?.id;
    closeMenu(true);
    select.selectedIndex = index;
    sync(control);
    if (changed) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      enhance();
      if (!trigger.isConnected) {
        const replacement = [...document.querySelectorAll("select")].find(candidate => select.id ? candidate.id === select.id : candidate.name === select.name && candidate.form?.id === formId);
        controls.get(replacement)?.trigger.focus();
      }
    }
  }

  function openMenu(control) {
    closeMenu();
    sync(control);
    if (control.trigger.disabled) return;
    const { select, trigger } = control;
    const menu = document.createElement("div");
    menu.className = "select-menu";
    menu.id = trigger.getAttribute("aria-controls");
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", trigger.getAttribute("aria-label"));
    menu.setAttribute("popover", "manual");
    [...select.options].forEach((option, index) => {
      const item = document.createElement("div");
      item.className = "select-menu-option";
      item.id = `${menu.id}-${index}`;
      item.dataset.index = String(index);
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.setAttribute("aria-disabled", String(option.disabled));
      const label = document.createElement("span");
      label.textContent = option.textContent;
      const check = document.createElement("span");
      check.className = "select-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = option.selected ? "✓" : "";
      item.append(label, check);
      item.addEventListener("pointerdown", event => event.preventDefault());
      item.addEventListener("click", () => choose(index));
      menu.append(item);
    });
    (select.closest("dialog") || document.body).append(menu);
    opened = { ...control, menu, index: select.selectedIndex };
    trigger.setAttribute("aria-expanded", "true");
    if (menu.showPopover) menu.showPopover();
    positionMenu();
    activate(select.selectedIndex >= 0 ? select.selectedIndex : 0);
  }

  function enhance() {
    if (opened && !opened.select.isConnected) closeMenu();
    for (const select of document.querySelectorAll("select")) {
      if (controls.has(select)) { sync(controls.get(select)); continue; }
      const wrapper = document.createElement("span");
      wrapper.className = "select-control";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "select-trigger";
      trigger.setAttribute("role", "combobox");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", `select-menu-${++serial}`);
      trigger.setAttribute("aria-label", select.getAttribute("aria-label") || select.labels?.[0]?.querySelector("span")?.textContent || "选择选项");
      const text = document.createElement("span");
      text.className = "select-value";
      trigger.append(text);
      trigger.insertAdjacentHTML("beforeend", chevron);
      select.before(wrapper);
      wrapper.append(select, trigger);
      select.classList.add("select-native");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      const control = { select, trigger, text };
      controls.set(select, control);
      sync(control);
      trigger.addEventListener("click", event => {
        event.preventDefault();
        if (opened?.select === select) closeMenu(); else openMenu(control);
      });
      trigger.addEventListener("keydown", event => {
        if (event.key === "Tab") { closeMenu(); return; }
        if (event.key === "Escape" && opened) { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
        if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          if (!opened) { openMenu(control); return; }
          if (["Enter", " "].includes(event.key)) { choose(opened.index); return; }
          const enabled = [...select.options].map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
          const offset = enabled.indexOf(opened.index);
          const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : Math.max(0, Math.min(enabled.length - 1, offset + (event.key === "ArrowDown" ? 1 : -1)));
          activate(enabled[next]);
        }
      });
    }
  }

  document.addEventListener("pointerdown", event => {
    if (opened && !opened.trigger.contains(event.target) && !opened.menu.contains(event.target)) closeMenu();
  });
  document.addEventListener("scroll", event => {
    if (opened && event.target !== opened.menu) closeMenu();
  }, true);
  document.addEventListener("close", () => closeMenu(), true);
  window.addEventListener("resize", () => closeMenu());
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches("select, .select-control") || node.querySelector("select"))))) enhance();
  }).observe(document.body, { childList: true, subtree: true });
  enhance();
})();
