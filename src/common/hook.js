export class Hook {
  target = new EventTarget();
  pool = {};
  oncePool = {};

  get boundedEvents() {
    return Object.keys({
      ...this.pool,
      ...this.oncePool
    });
  }

  on(type, listener) {
    if (typeof listener !== "function") return;
    (this.pool[type] || (this.pool[type] = new Set())).add(listener);
  }

  off(type, listener) {
    if (listener) {
      this.pool[type]?.delete?.(listener);
      this.oncePool[type]?.delete?.(listener);
    } else {
      this.pool[type]?.clear?.();
      this.oncePool[type]?.clear();
    }
    if (!this.pool[type]?.size) Reflect.deleteProperty(this.pool, type);
    if (!this.oncePool[type]?.size) Reflect.deleteProperty(this.pool, type);
  }

  once(type, listener) {
    if (typeof listener !== "function") return;
    (this.oncePool[type] || (this.oncePool[type] = new Set())).add(listener);
  }

  #bind(type, listeners) {
    listeners.forEach(listener => {
      this.target.addEventListener(type, listener);
    });
  }

  #remove(type, listeners) {
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

    const lastError = self.onerror;
    let currentFn;
    const resultsMap = new WeakMap();
    const results = [];
    self.onerror = (e, source, lineno, colno, error) => {
      results.push(error);
      resultsMap.set(currentFn, error);
    };
    const listeners = [
      ...(this.oncePool[type] ?? []),
      ...(this.pool[type] ?? [])
    ].map(fn => e => {
      currentFn = fn;
      const ret = fn(e);
      results.push(ret);
      resultsMap.set(currentFn, ret);
    });
    Reflect.deleteProperty(this.oncePool, type);
    this.#bind(type, listeners);
    this.target.dispatchEvent(e);
    e.result = fn => resultsMap.get(fn);
    e.results = results;
    self.onerror = lastError;
    this.#remove(type, listeners);
    return e;
  }
}
