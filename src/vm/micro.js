import { Channel } from "../common/channel";
import { DIFF_TYPES, EVENT_TYPES } from "../common/constants";
import { Node } from "./node";

export class Micro extends Node {
  microChannel;

  diff() {
    this.microChannel?.destroy?.();
    this.microChannel = new Channel();
    this.microChannel.register(EVENT_TYPES.patch, this.patchHandler);
    this.microChannel.connect(this.props.port);
  }

  patchHandler = patchs => {
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

  emit = e => {
    const reg = new RegExp(`^${this.id}`);
    const shouldCall = reg.test(e.id);
    if (shouldCall) {
      this.microChannel.postMessage(EVENT_TYPES.call, {
        ...e,
        id: e.id.replace(reg, "")
      });
    }
  };

  destroy() {
    super.destroy();
    this.microChannel?.destroy?.();
    this.microChannel = null;
  }
}

export function MicroComponent() {}
