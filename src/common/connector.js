import { METHOD_TYPES } from "./constants";
import { Hook } from "./hook";

function include(a, b) {
  return b === (a & b);
}

export class Connector {
  /**@type {WeakMap<MessagePort, Connector>} */
  static map = new WeakMap();
  static getInstance(port) {
    if (!this.map.has(port)) {
      this.map.set(port, new this(port));
    }
    return this.map.get(port);
  }

  /** @type {MessagePort} */
  port;
  handlers = new Hook();
  resolvers = {};

  rid;
  buffers = {};

  time;
  index;

  get id() {
    return this.time * 4096 + this.index; // port已经区分了来源 不需要容器ID
  }

  constructor(port) {
    this.port = port;
    port.addEventListener("message", this.onMessage);
    port.start?.();
    this.postMessage(0);
  }

  onMessage = ({ data }) => {
    const { prev, id } = data;
    if (prev) {
      this.buffers[prev] = data;
    } else {
      this.rid = +id;
    }

    this.readBuffer();
  };

  readBuffer() {
    if (!this.rid) return;
    const keys = Object.keys(this.buffers)
      .map(id => +id)
      .sort();
    for (const rid of keys) {
      if (rid < this.rid) {
        Reflect.deleteProperty(this.buffers, rid);
        continue;
      }
      if (rid !== this.rid) return;
      const { type, body, id, rid: r } = this.buffers[rid];
      this.rid = id;
      Reflect.deleteProperty(this.buffers, rid);
      if (include(type, METHOD_TYPES.receipt)) {
        this.resolvers[r]?.(body);
        continue;
      }
      const { results } = this.handlers.dispatch(type, body);
      if (!results.length) continue;
      if (include(type, METHOD_TYPES.send)) {
        const result = results.find(r => !(r instanceof Error));
        if (result) this.receiptMessage(result);
      }
    }
  }

  updateId() {
    const time = Date.now();
    if (time !== this.time) {
      this.time = time;
      this.index = 0;
    }
    this.index++;
  }

  addHead(msg) {
    if (this.time) msg.prev = this.id;
    this.updateId();
    msg.id = this.id;
    return msg;
  }

  addMethod(msg, method) {
    const filterCode = ~METHOD_TYPES.maskCode;
    msg.type = (msg.type & filterCode) | method;
    return msg;
  }

  packMessage(msg, method) {
    this.port.postMessage(msg |> this.addMethod(%, method) |> this.addHead(%));
  }

  postMessage(type, body) {
    this.packMessage({ type, body }, METHOD_TYPES.post);
  }

  sendMessage(type, body) {
    this.packMessage({ type, body }, METHOD_TYPES.send);
    const id = this.id;
    let cancel;
    const ret = new Promise((res, rej) => {
      cancel = reason => {
        Reflect.deleteProperty(this.resolvers, id);
        rej(reason);
      };
      this.resolvers[id] = body => {
        Reflect.deleteProperty(this.resolvers, id);
        res(body);
      };
    });
    ret.cancel = cancel;
    return ret;
  }

  async receiptMessage(body) {
    const rid = this.rid;
    if (body instanceof Promise) body = await body;
    this.packMessage({ body, rid }, METHOD_TYPES.receipt);
  }

  register(type, handler) {
    this.handlers.on(type | METHOD_TYPES.post, handler);
    this.handlers.on(type | METHOD_TYPES.send, handler);
  }

  unregister(type, handler) {
    this.handlers.off(type | METHOD_TYPES.post, handler);
    this.handlers.off(type | METHOD_TYPES.send, handler);
  }
}
