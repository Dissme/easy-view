export default class EventProxy {
  pool = {};
  ele;
  callOut;

  constructor(ele, callOut) {
    this.ele = ele;
    this.callOut = callOut;
  }

  on(evtName, id) {
    if (!this.pool[evtName]) {
      this.pool[evtName] = new Set();
      this.ele.addEventListener(evtName, this.handler);
    }
    this.pool[evtName].add(id);
  }

  off(evtName, id) {
    if (evtName === "*") {
      return Object.keys(this.pool).forEach(key => {
        this.pool[key]?.delete?.(id);
      });
    }
    if (!this.pool[evtName]) return;
    if (this.pool[evtName]) this.pool[evtName].delete(id);
    if (this.pool[evtName].size) {
      this.ele.removeEventListener(evtName, this.handler);
    }
  }

  offWithRegExp(reg) {
    let removed = {};
    Object.keys(this.pool).forEach(evtName => {
      if (!this.pool[evtName]) return;
      const ids = [];
      this.pool[evtName].forEach(id => {
        if (reg.test(id)) {
          (removed[evtName] || (removed[evtName] = [])).push(id);
          ids.push(id);
        }
      });
      ids.forEach(id => this.off("*", id));
    });
    return removed;
  }

  /**
   *
   * @param {Event} e
   * @returns
   */
  handler = e => {
    const { type, target } = e;
    if (!this.pool[type]) return;
    let srcId = null;
    for (const id of this.pool[type]) {
      if (!isChild(id, target?.getAttribute?.("_eid"))) continue;
      if (!srcId || srcId.length < id.length) srcId = id;
    }

    this.callOut({
      ...this.copyEvent(e),
      _domEvt: true,
      type,
      id: srcId
    });
  };

  copyEvent(e) {
    const validTypes = ["boolean", "string", "number", "undefined"];
    const result = {};
    for (const key in e) {
      if (validTypes.includes(typeof e[key])) {
        result[key] = e[key];
      }
    }
    return result;
  }

  destroy() {
    Object.keys(this.pool).forEach(key => {
      this.ele.removeEventListener(key, this.handler);
    });
    this.ele = null;
  }
}

function isChild(parentId, childId) {
  if (parentId === childId) return true;
  const reg = new RegExp(`^${parentId}`);
  return reg.test(childId);
}