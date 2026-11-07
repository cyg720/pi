/* Message landmarks; no model requests or execution changes. */
(() => {
  "use strict";
  let dispose = () => {};
  function entries(messages) {
    return messages.flatMap((message, index) => {
      if (message.role !== "user") return [];
      const nextUser = messages.findIndex((next, i) => i > index && next.role === "user");
      return [{ index, title: message.text, reply: messages.slice(index + 1, nextUser < 0 ? messages.length : nextUser).filter(next => next.role === "agent").map(next => next.text).join("\n") }];
    });
  }
  function attach() {
    dispose();
    const pane = document.querySelector(".conversation-pane");
    const nav = pane?.querySelector(".turn-navigation");
    if (!nav) return;
    const preview = nav.querySelector(".turn-preview");
    const show = event => {
      const button = event.target.closest(".turn-tick");
      if (!button) return;
      preview.querySelector("strong").textContent = button.dataset.previewTitle;
      preview.querySelector("p").textContent = button.dataset.previewReply;
      preview.style.width = `${Math.min(310, pane.clientWidth - 44)}px`;
    };
    nav.addEventListener("pointerover", show);
    nav.addEventListener("focusin", show);
    const scroll = pane?.querySelector(".chat-scroll");
    const buttons = [...(pane?.querySelectorAll(".turn-tick[data-message-index]") || [])];
    dispose = () => {
      nav.removeEventListener("pointerover", show);
      nav.removeEventListener("focusin", show);
    };
    if (!scroll || !buttons.length) return;
    const update = () => {
      const top = scroll.getBoundingClientRect().top;
      let active = buttons[0];
      for (const button of buttons) {
        const message = document.getElementById(`message-${button.dataset.messageIndex}`);
        if (message && message.getBoundingClientRect().top <= top + 100) active = button;
      }
      for (const button of buttons) button.setAttribute("aria-current", String(button === active));
    };
    scroll.addEventListener("scroll", update, { passive: true });
    update();
    const removePreview = dispose;
    dispose = () => { removePreview(); scroll.removeEventListener("scroll", update); };
  }
  window.WorkbenchTurnNavigation = { entries, attach };
})();
