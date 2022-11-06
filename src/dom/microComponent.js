customElements.define(
  "micro-component",
  class extends HTMLElement {
    destroyCallback;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      const domStyles = [].map.call(document.styleSheets, sheet =>
        sheet.ownerNode.cloneNode(true)
      );
      this.shadowRoot.prepend(...domStyles);
    }

    disconnectedCallback() {
      if (!this.parentNode) this.destroyCallback?.();
    }
  }
);
