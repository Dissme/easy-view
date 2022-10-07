import { Channel } from "../common/channel";
import { DIFF_TYPES, EVENT_TYPES } from "../common/constants";
import { Node } from "./node";

export class Micro extends Node {
  microChannel;
  lastPort;
  inited = false;

  diff() {
    if (this.lastPort === this.props.port) return;
    this.lastPort = this.props.port;
    this.microChannel?.destroy?.();
    this.inited = false;
    this.microChannel = new Channel();
    this.microChannel.connect(this.props.port);
    this.microChannel.register(EVENT_TYPES.patch, this.patchHandler);
    this.microChannel.register(EVENT_TYPES.destroy, () => this.destroy());
  }

  patchHandler = ({ body: patchs }) => {
    if (patchs[0].type === DIFF_TYPES.connect) this.inited = true;
    if (!this.inited) return;
    this.channel.postMessage(
      EVENT_TYPES.patch,
      patchs.map(({ id, type, payload }) => {
        const result = { id: `${this.id}${id}`, type, payload };
        if (type === DIFF_TYPES.connect) {
          result.payload = payload.map(obj => ({
            ...obj,
            id: `${this.id}${obj.id}`
          }));
        }
        if (type === DIFF_TYPES.move) {
          result.payload = { ...payload, id: `${this.id}${payload.id}` };
        }
        return result;
      })
    );
  };

  emit(e) {
    const reg = new RegExp(`^${this.id}`);
    const shouldCall = reg.test(e.detail?._eid);
    const type = e.type.replace(/_capture$/, "");

    if (shouldCall) {
      this.microChannel.postMessage(EVENT_TYPES.call, {
        type,
        detail: {
          ...e.detail,
          _eid: e.detail._eid.replace(reg, "")
        }
      });
    }

    return super.emit(e);
  }

  destroy() {
    super.destroy();
    this.microChannel?.destroy?.();
    this.microChannel = null;
    this.lastPort = null;
  }
}

export function MicroComponent() {}
