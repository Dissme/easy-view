import { EVENT_TYPES } from "./constants";
import { MultiKeyMap } from "./utils";

export default class GroupChannel {
  #channels = [];

  connect(port) {
    const channel = new Channel();
    channel.connect(port);
    return this.#channels.push(channel) - 1;
  }

  postMessage(type, body, ...cids) {
    let channels = this.#channels;
    if (cids.length) channels = channels.filter((_, cid) => cids.includes(cid));
    channels.forEach(channel => {
      channel.postMessage(type, body);
    });
  }

  sendMessage(type, body, cid) {
    return this.#channels[cid].sendMessage(type, body);
  }

  register(type, handler, cid) {
    this.#channels[cid]?.register(type, handler);
  }
}

export class Channel {
  #writeStrream;
  #readStream;

  #handlers = {};
  #resolvers = new MultiKeyMap();

  #messageHandler = async ({ type, body }) => {
    if (EVENT_TYPES.send === type) {
      const version = this.#readStream.version;
      const result = await this.#handlers[body.type]?.(body.body);
      this.postMessage(EVENT_TYPES.callBack, {
        version,
        type: body.type,
        result
      });
    } else if (EVENT_TYPES.receipt === type) {
      this.#resolvers.get(body.version, body.type)?.(body.result);
      this.#resolvers.delete(body.version, body.type);
    } else {
      this.#handlers[type]?.(body);
    }
  };

  connect(port) {
    this.#writeStrream = new WriteStrream(port);
    this.#readStream = new ReadStream(port, this.#messageHandler);
    this.#writeStrream.postMessage(EVENT_TYPES.connect);
  }

  register(type, handler) {
    this.#handlers[type] = handler;
  }

  postMessage(type, body) {
    this.#writeStrream.postMessage(type, body);
  }

  sendMessage(type, body) {
    const version = this.#writeStrream.postMessage(EVENT_TYPES.send, {
      type,
      body
    });
    return new Promise(r => this.#resolvers.set(version, type)(r));
  }

  destroy() {
    this.#writeStrream = this.#writeStrream.destroy();
    this.#readStream = this.#readStream.destroy();
  }
}

class WriteStrream {
  lastTime = performance.now();
  count = 0;
  port;

  get version() {
    return `${this.lastTime}-${this.count}`;
  }

  constructor(port) {
    this.port = port;
  }

  postMessage(type, body) {
    this.port.postMessage({
      type,
      body,
      lastVersion: this.version,
      version: this.updateVersion()
    });
    return this.version;
  }

  updateVersion() {
    const time = performance.now();
    if (time !== this.lastTime) {
      this.lastTime = time;
      this.count = 0;
    } else {
      this.count++;
    }
    return this.version;
  }

  destroy() {
    this.port = null;
  }
}

class ReadStream {
  version;
  buffer = {};
  inputHandler;
  port;

  constructor(port, inputHandler) {
    port.addEventListener("message", this.messageHandler);
    this.port = port;
    this.inputHandler = inputHandler;
    port.start?.();
  }

  messageHandler = ({ data }) => {
    const { type, version, lastVersion } = data;
    if (type === EVENT_TYPES.connect) {
      this.version = version;
      this.inputHandler({ type });
    } else {
      this.buffer[lastVersion] = data;
    }
    this.readBuffer();
  };

  readBuffer() {
    if (!this.version) return;
    const versions = Object.keys(this.buffer).sort((v1, v2) => {
      const [t1, c1] = v1.split("-");
      const [t2, c2] = v2.split("-");
      const t = t1 - t2;
      return t || c1 - c2;
    });

    const [t, c] = this.version.split("-");

    while (versions.length) {
      const version = versions.pop();
      const [t2, c2] = version.split("-");
      if (+t2 < +t || (t2 === t && +c2 < +c)) {
        Reflect.deleteProperty(this.buffer, version);
        continue;
      }
      if (this.version !== version) return;
      const { type, body, version: cur } = this.buffer[version];
      this.version = cur;
      Reflect.deleteProperty(this.buffer, version);
      this.inputHandler({ type, body });
    }
  }

  destroy() {
    this.buffer = null;
    this.inputHandler = null;
    this.port.removeEventListener("message", this.messageHandler);
    this.port.close?.();
    this.port.terminate?.();
    this.port = null;
  }
}
