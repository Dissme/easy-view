import { EVENT_TYPES } from "./constants";
import { Hook } from "./hook";

class Stream {
  static map = new WeakMap();
  static getInstance(port) {
    if (this.map.has(port)) return this.map.get(port);
    const instance = new this(port);
    this.map.set(port, instance);
    return instance;
  }

  port;

  constructor(port) {
    this.port = port;
  }
}

export class WriteStream extends Stream {
  static map = new WeakMap();

  lastTime = performance.now();
  count = 0;

  get version() {
    return `${this.lastTime}-${this.count}`;
  }

  constructor(port) {
    super(port);
    this.postMessage({ type: EVENT_TYPES.connect });
  }

  postMessage(msg) {
    msg.prev = this.version;
    msg.current = this.updateVersion();
    this.port.postMessage(msg);
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
}

export class ReadStream extends Stream {
  static map = new WeakMap();

  version = "";
  buffer = {};
  hook = new Hook();

  constructor(port) {
    super(port);
    port.addEventListener("message", this.onMessage);
    port.start?.();
  }

  onMessage = ({ data }) => {
    const { type, current, prev } = data;
    if (type === EVENT_TYPES.connect) {
      if (this.version) return;
      this.version = current;
      this.hook.dispatch(type);
    } else {
      this.buffer[prev] = data;
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
      const { type, current, ...detail } = this.buffer[version];
      this.version = current;
      Reflect.deleteProperty(this.buffer, version);
      this.hook.dispatch(type, detail);
    }
  }

  register(type, handler) {
    if (type === EVENT_TYPES.connect) {
      if (this.version) this.hook.once(type, handler);
      else handler();
    } else this.hook.on(type, handler);
  }

  unregister(type, handler) {
    this.hook.off(type, handler);
  }
}
