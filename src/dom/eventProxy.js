const plugins = {};

export function use(options) {
  Object.assign(plugins, options);
}
export class EventProxy {
  ele;
  callOut;
  pool = {};

  constructor(ele, callOut) {
    this.ele = ele;
    this.callOut = callOut;
  }

  defaultUnbind() {}

  getEventNames(id) {
    const result = {};
    Object.keys(this.pool).forEach(eventName => {
      if (this.pool[eventName][id]) result[eventName] = true;
    });
    return result;
  }

  on(eventName, id, target) {
    if (!this.pool[eventName]) {
      this.pool[eventName] = {};
      this.ele.addEventListener(eventName, this.handler);
    }

    if (this.pool[eventName][id]) return this.pool[eventName][id];
    this.pool[eventName][id] = this.defaultUnbind;

    const off = plugins[eventName]?.call?.(
      this.ele,
      target,
      this.dispatch.bind(null, eventName, target)
    );

    if (off) this.pool[eventName][id] = off;

    return this.pool[eventName][id];
  }

  move(curId, nextId) {
    Object.keys(this.pool).forEach(eventName => {
      const off = this.pool[eventName][curId];
      if (!off) return;
      this.pool[eventName][nextId] = off;
      Reflect.deleteProperty(this.pool[eventName], curId);
    });
  }

  off(eventName, id) {
    if (eventName === "*") {
      return Object.keys(this.pool).filter(name => {
        if (!this.pool[name][id]) return;
        this.off(name, id);
        return true;
      });
    }

    if (!this.pool[eventName]) return;
    if (this.pool[eventName][id]) {
      this.pool[eventName][id]();
      Reflect.deleteProperty(this.pool[eventName], id);
    }
    if (!Object.keys(this.pool[eventName]).length) {
      this.ele.removeEventListener(eventName, this.handler);
      Reflect.deleteProperty(this.pool, eventName);
    }
  }

  handler = e => {
    let { type, detail, target } = e;
    if (!this.pool[type]) return;
    let srcId = null;

    Object.keys(this.pool[type]).forEach(id => {
      if (!isChild(id, target?.getAttribute?.("_eid"))) return;
      if (!srcId || srcId.length < id.length) srcId = id;
    });

    if (!srcId) return;

    if (plugins[type]?.format) detail = plugins[type].format(e);
    if (detail === undefined || detail === null) detail = {};
    if (typeof detail !== "object") detail = { value: detail };
    detail._eid = srcId;

    this.callOut({
      type,
      detail
    });
  };

  dispatch(type, target, detail) {
    target.dispatchEvent(
      new CustomEvent(type, {
        bubbles: true,
        detail
      })
    );
  }

  destroy() {
    Object.keys(this.pool).forEach(key => {
      Object.keys(this.pool[key]).forEach(off => off());
      this.ele.removeEventListener(key, this.handler);
    });
    this.pool = null;
    this.ele = null;
  }
}

function isChild(parentId, childId) {
  if (parentId === childId) return true;
  const reg = new RegExp(`^${parentId}`);
  return reg.test(childId);
}
