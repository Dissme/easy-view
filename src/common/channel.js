import { EVENT_TYPES } from "./constants";
import { Hook } from "./hook";
import { WriteStream, ReadStream } from "./stream";

export class Channel {
  #writeStream;
  #readStream;
  #handlers = {};
  destroyed = true;

  connect(port) {
    if (!this.destroyed) this.destroy();
    this.#readStream = ReadStream.getInstance(port);
    this.#writeStream = WriteStream.getInstance(port);
    this.destroyed = false;
  }

  register(type, handler) {
    this.#handlers[type] = e => handler(e?.detail);
    this.#readStream.register(type, this.#handlers[type]);
  }

  postMessage(type, body) {
    const prev = this.#writeStream.version;
    this.#writeStream.postMessage({
      type,
      body
    });
    return prev;
  }

  destroy() {
    if (this.destroyed) return;
    this.postMessage(EVENT_TYPES.destroy);
    Object.keys(this.#handlers, type => {
      this.#readStream.unregister(type, this.#handlers[type]);
    });
    this.#handlers = {};
    this.#writeStream = null;
    this.#readStream = null;
  }
}

export class MethodChannel extends Channel {
  #handlers = {};
  #resolvers = new Hook();

  timeout = 3000;

  connect(port) {
    super.connect(port);
    super.register(EVENT_TYPES.send, this.#onSend);
    super.register(EVENT_TYPES.receipt, this.#onReceipt);
    super.register(EVENT_TYPES.userCall, this.#onUserCall);
  }

  #onSend = async ({ body: { methodName, params }, prev }) => {
    const result = await this.#handlers[methodName]?.call?.(null, params);
    super.postMessage(EVENT_TYPES.receipt, { result, prev });
  };

  #onReceipt = ({ body: { result, prev } }) => {
    this.#resolvers.dispatch(prev, result);
  };

  #onUserCall = ({ body: { methodName, params } }) => {
    this.#handlers[methodName]?.call?.(null, params);
  };

  register(methodName, method) {
    this.#handlers[methodName] = method;
  }

  unregister(methodName) {
    Reflect.deleteProperty(this.#handlers, methodName);
  }

  postMessage(methodName, params) {
    super.postMessage(EVENT_TYPES.userCall, { methodName, params });
  }

  sendMessage(methodName, params) {
    const prev = super.postMessage(EVENT_TYPES.send, { methodName, params });
    return new Promise((resolve, reject) => {
      this.#resolvers.once(prev, ({ detail }) => resolve(detail));
      setTimeout(() => {
        this.#resolvers.off(prev);
        reject("timeout");
      }, this.timeout);
    });
  }
}

export default class GroupChannel {
  #channels = [];

  connect(port) {
    const channel = new Channel();
    channel.connect(port);
    return this.#channels.push(channel) - 1;
  }

  disconnect(cid) {
    this.#channels[cid]?.destroy?.();
    this.#channels[cid] = null;
  }

  postMessage(type, body, ...cids) {
    let channels = this.#channels;
    if (cids.length) {
      channels = channels.filter(
        (channel, cid) => channel && cids.includes(cid)
      );
    }
    channels.forEach(channel => {
      channel.postMessage(type, body);
    });
  }

  register(type, handler, cid) {
    this.#channels[cid]?.register(type, handler);
  }

  destroy() {
    this.#channels.forEach(channel => channel?.destroy?.());
    this.#channels = [];
  }
}
