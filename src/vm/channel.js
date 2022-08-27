import { DIFF_TYPES } from "./node";

export class VMChannel {
  ports = [];
  fn;
  lastTime = performance.now();
  count = 0;

  timer = null;
  patchs = [];

  get version() {
    return `${this.lastTime}-${this.count}`;
  }

  constructor(fn) {
    this.fn = fn;
  }

  addPort(port) {
    const cid = this.ports.push(port);
    port.onmessage = e => this.onMessage(e, cid);
    port.postMessage({
      body: "connect",
      version: this.version
    });
    return cid;
  }

  callOut = patch => {
    const cid = patch.payload?.cid;
    if (cid) return this.postMessage([patch], cid);

    const last = this.patchs[this.patchs.length - 1];
    if (
      last?.id === patch.id &&
      last.type < DIFF_TYPES.delete &&
      patch.type === DIFF_TYPES.update
    ) {
      Object.assign(last.payload, patch.payload);
    } else {
      this.patchs.push(patch);
    }

    if (!this.timer) {
      this.timer = Promise.resolve().then(() => {
        this.postMessage(this.patchs);
        this.patchs = [];
        this.timer = null;
      });
    }
  };

  postMessage(body, cid) {
    this.ports.forEach((port, index) => {
      const isCurrent = !cid || index === cid - 1;
      port.postMessage({
        body: isCurrent ? body : null,
        lastVersion: this.version,
        version: this.updateVersion()
      });
    });
  }

  onMessage({ data }, cid) {
    if (data?.version !== this.version) {
      return console.error(data);
    }
    return this.fn(data?.body, cid);
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
