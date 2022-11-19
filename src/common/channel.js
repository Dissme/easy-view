import { Connector } from "./connector";
import { CONNECTOR_TYPES } from "./constants";

export class Channel {
  static type = CONNECTOR_TYPES.channel;

  #ctx;
  handlers = {};

  connect(port) {
    this.disconnect();
    this.#ctx = Connector.getInstance(port);
    this.#ctx.register(this.constructor.type, this.#callback);
  }

  #callback = ({ detail: { method, params, transfers } }) => {
    const fn = this.handlers[method];
    if (!fn) throw new ReferenceError(`未注册的函数 ${method}`);
    return fn(params || transfers);
  };

  postMessage(method, params) {
    if (!this.#ctx) return;
    this.#ctx.postMessage(this.constructor.type, { method, params });
  }

  sendMessage(method, params) {
    if (!this.#ctx) return;
    return this.#ctx.sendMessage(this.constructor.type, { method, params });
  }

  transfer(method, transfers) {
    if (!this.#ctx) return;
    this.#ctx.postMessage(this.constructor.type, { method, transfers });
  }

  register(method, handler) {
    this.handlers[method] = handler;
  }

  disconnect() {
    if (!this.#ctx) return;
    this.#ctx.unregister(this.constructor.type, this.#callback);
    this.#ctx = null;
  }
}

export class MethodChannel extends Channel {
  static type = CONNECTOR_TYPES.method;

  unregister(method) {
    Reflect.deleteProperty(this.handlers, method);
  }
}

export default class GroupChannel {
  channels = [];
  handlers = {};

  add(channel) {
    const cid = this.channels.length;
    this.channels[cid] = channel;
    channel.handlers = this.handlers;
    return cid;
  }

  register(method, handler) {
    this.handlers[method] = handler;
  }

  postMessage(method, params) {
    this.channels.forEach(channel => channel.postMessage(method, params));
  }

  postMessage2C(method, params, cid) {
    this.channels[cid].postMessage(method, params);
  }
}
