export class Hook {
  target = new EventTarget();
  pool = {};
  oncePool = {};

  listeners = [];

  get boundedEvents() {
    return Object.keys({
      ...this.pool,
      ...this.oncePool
    }).filter(name => name !== "*");
  }

  on(type, listener) {
    if (typeof listener !== "function") return;
    (this.pool[type] || (this.pool[type] = new Set())).add(listener);
  }

  off(type, listener) {
    if (listener === undefined) {
      this.pool[type]?.clear?.();
    } else {
      this.pool[type]?.delete?.(listener);
      this.oncePool[type]?.delete?.(listener);
    }
  }

  once(type, listener) {
    if (typeof listener !== "function") return;
    (this.oncePool[type] || (this.oncePool[type] = new Set())).add(listener);
  }

  #bind(type) {
    this.listeners.forEach(listener => {
      this.target.addEventListener(type, listener);
    });
  }

  #remove(type) {
    this.listeners.forEach(listener => {
      this.target.removeEventListener(type, listener);
    });
    this.listeners = [];
  }

  dispatch(type, detail = null) {
    const e = new CustomEvent(type, {
      detail,
      cancelable: true,
      bubbles: true
    });

    const lastError = self.onerror;
    let currentFn;
    const resultsMap = new WeakMap();
    const results = [];
    self.onerror = (e, source, lineno, colno, error) => {
      results.push(error);
      resultsMap.set(currentFn, error);
    };
    this.listeners = [
      ...(this.oncePool["*"] ?? []),
      ...(this.oncePool[type] ?? []),
      ...(this.pool["*"] ?? []),
      ...(this.pool[type] ?? [])
    ].map(fn => e => {
      currentFn = fn;
      const ret = fn(e);
      results.push(ret);
      resultsMap.set(currentFn, ret);
    });
    this.oncePool["*"] = new Set();
    this.oncePool[type] = new Set();
    this.#bind(type);
    this.target.dispatchEvent(e);
    e.result = fn => resultsMap.get(fn);
    e.results = results;
    self.onerror = lastError;
    this.#remove(type);
    return e;
  }
}
