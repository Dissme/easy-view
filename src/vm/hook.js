export class Hook {
  target = new EventTarget();
  pool = {};
  oncePool = {};

  on(type, listener) {
    if (typeof listener !== "function") return;
    (this.pool[type] || (this.pool[type] = new Set())).add(listener);
  }

  off(type, listener) {
    this.pool[type]?.delete?.(listener);
    this.oncePool[type]?.delete?.(listener);
  }

  once(type, listener) {
    if (typeof listener !== "function") return;
    this.oncePool[type] || (this.oncePool[type] = new Set()).add(listener);
  }

  #bind(type, listeners = []) {
    listeners.forEach(listener => {
      this.target.addEventListener(type, listener);
    });
  }

  #remove(type, listeners = []) {
    listeners.forEach(listener => {
      this.target.removeEventListener(type, listener);
    });
  }

  dispatch(type, detail = null) {
    const e = new CustomEvent(type, {
      detail,
      cancelable: true,
      bubbles: true
    });

    const oncePool = this.oncePool[type];
    const pool = [...(this.pool[type] ?? [])];
    this.oncePool[type] = new Set();
    this.#bind(type, oncePool);
    this.#bind(type, pool);
    this.target.dispatchEvent(e);
    this.#remove(type, oncePool);
    this.#remove(type, pool);
    return e;
  }
}
