import { DIFF_TYPES, EVENT_TYPES, NODE_STATES } from "../common/constants";
import {
  debounce,
  flatNodes,
  sameChildren,
  sameNode,
  sameObj
} from "./helpers";
import { Hook } from "./hook";

export const IS_RENDER = Symbol("IS_RENDER");
export function defineRender(fn) {
  fn[IS_RENDER] = true;
  return fn;
}

export function Fragment(props, children = []) {
  return children;
}

export class Node {
  static filterProps(props) {
    const validTypes = ["boolean", "string", "number"];
    return Object.keys(props).reduce(
      (obj, key) =>
        validTypes.includes(typeof props[key])
          ? { ...obj, [key]: props[key] }
          : obj,
      {}
    );
  }

  static filterEventHandlers(eventHandlers) {
    return [
      ...new Set(
        Object.keys(eventHandlers).map(evtName =>
          evtName.replace(/(_capture)?$/, "")
        )
      )
    ];
  }

  static node2obj(node) {
    if (node instanceof Node) {
      node = {
        id: node.id,
        state: node.state,
        tag: typeof node.tag === "function" ? node.tag.name : node.tag,
        props: this.filterProps(node.props),
        eventHandlers: this.filterEventHandlers(node.eventHandlers),
        _fragment: typeof node.tag === "function"
      };
    } else {
      node = {
        id: node.id,
        text: node.text,
        _text: true
      };
    }
    return node;
  }

  parent;
  index = 0;
  state = NODE_STATES.resolved;
  hook = new Hook();
  updateHandler;

  channel;
  patchs = [];
  timer;

  fetchFlag = {};

  /** @type {String|(props, children, eventHandlers, hook) => Promise<Function|Node>} */
  tag = Fragment;
  key;
  children = [];
  props = {};
  eventHandlers = {};
  results = [];

  get id() {
    return `${this.parent?.id ?? ""},${this.index}`;
  }

  constructor(initails) {
    Object.assign(this, initails);
    this.hook.on("update", this.update);
    this.hook.on("destroy", this.destroy);
    this.bindEventHandlers();
  }

  update = debounce(() => {
    if (this.state === NODE_STATES.fetching) return;
    this.diff();
  });

  destroy = () => {
    this.parent = null;
    this.channel = null;
    this.offBindEventHandlers();
  };

  callInital(cid) {
    if (!this.channel) throw "非法调用";
    const nodes = [];
    const rs = [this];
    while (rs.length) {
      const cur = rs.shift();
      rs.push(...(cur.results ?? []));
      nodes.push(Node.node2obj(cur));
    }
    this.channel.postMessage(
      EVENT_TYPES.patch,
      [
        {
          id: this.id,
          type: DIFF_TYPES.connect,
          payload: nodes
        }
      ],
      cid
    );
  }

  emit(e) {
    const isUserEvt = !e.detail?._eid;
    const shouldCall = new RegExp(`^${this.id}`).test(e.detail?._eid);
    if (!isUserEvt && !shouldCall) return;
    const eventName = e.type.replace(/(_capture)?$/, "");
    const captureName = `${eventName}_capture`;

    if (!e.cancelBubble) {
      e = this.hook.dispatch(captureName, e.detail);
    }

    if (!isUserEvt) {
      this.results.forEach(node => {
        e = node.emit?.(e) ?? e;
      });
    }

    e = e.cancelBubble ? e : this.hook.dispatch(eventName, e.detail);

    if (!e.defaultPrevented && eventName !== "update") {
      this.emit({ type: "update" });
    }

    return e;
  }

  cancel() {
    this.fetchFlag = null;
    this.state = NODE_STATES.resolved;
    this.results.forEach(node => node.cancel?.());
  }

  setResults(results) {
    this.results = flatNodes([results]).map((result, index) => {
      if (result instanceof Node) {
        result.parent = this;
        result.index = index;
      } else {
        result = { id: `${this.id},${index}`, text: result, _text: true };
      }
      return result;
    });
  }

  callOut(id, type, payload) {
    const last = this.patchs[this.patchs.length - 1];
    if (
      last?.id === id &&
      last.type < DIFF_TYPES.delete &&
      type === DIFF_TYPES.update
    ) {
      Object.assign(last.payload, payload);
    } else {
      this.patchs.push({ id, type, payload });
    }

    if (!this.timer) {
      this.timer = Promise.resolve().then(() => {
        if (this.channel) {
          this.channel.postMessage(EVENT_TYPES.patch, this.patchs);
        }
        this.patchs = [];
        this.timer = null;
      });
    }
  }

  bindEventHandlers() {
    Object.keys(this.eventHandlers).forEach(type => {
      this.hook.on(type, this.eventHandlers[type]);
    });
  }

  offBindEventHandlers() {
    Object.keys(this.eventHandlers).forEach(type => {
      this.hook.off(type, this.eventHandlers[type]);
    });
  }

  async diff() {
    const lastResults = [...this.results];
    const moves = [];

    let result = this.children;
    if (typeof this.tag === "function") {
      result = this.updateHandler ? this.updateHandler() : await this.fetch();
    }
    this.setResults(result);
    const curResults = [...this.results];

    const ks = {};
    curResults.forEach((node, index) => {
      if (node.key) ks[node.key] = index;
    });

    let lastIndex = 0;
    let curIndex = 0;

    while (lastIndex < lastResults.length && curIndex < curResults.length) {
      const last = lastResults[lastIndex];
      let cur = curResults[curIndex];

      if (!last) {
        lastIndex++;
        continue;
      }

      if (!cur) {
        curIndex++;
        continue;
      }

      if (last._text) {
        if (last.id === cur.id && cur._text) {
          if (last.text !== cur.text) {
            this.callOut(last.id, DIFF_TYPES.update, { text: cur.text });
          }
          lastResults[lastIndex] = null;
          curResults[curIndex] = null;
          curIndex++;
        }
        lastIndex++;
        continue;
      }

      if (last.index !== lastIndex) {
        moves.push({ from: lastIndex, to: last.index });
        lastResults[lastIndex] = null;
        curResults[last.index] = null;
        lastIndex++;
        continue;
      }

      let index = curIndex;
      if (last.key in ks) {
        index = ks[last.key];
        cur = curResults[index];
        Reflect.deleteProperty(ks, last.key);
      }

      if (!sameNode(cur, last)) {
        lastIndex++;
        continue;
      }

      let isDiffrent = false;

      if (!sameObj(cur.props, last.props)) {
        this.callOut(last.id, DIFF_TYPES.update, {
          props: Node.filterProps(cur.props)
        });
        Object.keys({
          ...last.props,
          ...cur.props
        }).forEach(key => {
          last.props[key] = cur.props[key];
        });
        isDiffrent = true;
      }

      if (!sameChildren(last, cur)) {
        last.children.splice(0, last.children.length, ...cur.children);
        isDiffrent = true;
      }

      if (!sameObj(last.eventHandlers, cur.eventHandlers)) {
        this.callOut(last.id, DIFF_TYPES.update, {
          eventHandlers: Node.filterEventHandlers(cur.eventHandlers)
        });
        last.offBindEventHandlers();
        Object.keys({
          ...last.eventHandlers,
          ...cur.eventHandlers
        }).forEach(key => {
          last.eventHandlers[key] = cur.eventHandlers[key];
        });
        last.bindEventHandlers();
        isDiffrent = true;
      }

      if (lastIndex !== index) {
        moves.push({ from: lastIndex, to: index });
        last.index = index;
      }

      this.results[index] = last;
      curResults[index] = null;
      lastResults[lastIndex] = null;
      last.key = cur.key;

      if (isDiffrent) {
        last.emit?.({
          type: "update"
        });
      }
    }

    curResults.forEach(item => {
      if (item) {
        this.callOut(item.id, DIFF_TYPES.create, Node.node2obj(item));
        if (item instanceof Node) {
          item.channel = this.channel;
          item.emit({
            type: "update"
          });
        }
      }
    });

    moves.forEach(({ from, to }) => {
      this.callOut(`${this.id},${from}`, DIFF_TYPES.move, {
        id: `${this.id},${to}`
      });
    });

    lastResults.forEach(item => {
      if (item) {
        this.callOut(item.id, DIFF_TYPES.delete);
        if (item instanceof Node) item.emit({ type: "destroy" });
      }
    });
  }

  async fetch() {
    if (this.state === NODE_STATES.fetching) this.cancel();
    this.state = NODE_STATES.fetching;
    this.callOut(this.id, DIFF_TYPES.update, { state: this.state });

    const flag = {};
    this.fetchFlag = flag;

    let results;
    try {
      results = await this.tag.call(null, this.props, this.children, {
        on: (type, listener) => {
          this.hook.on(type, listener);
        },
        off: (type, listener) => {
          this.hook.off(type, listener);
        },
        once: (type, listener) => {
          this.hook.once(type, listener);
        },
        dispatch: (type, detail) => {
          this.emit({ type, detail });
        }
      });
      this.state = NODE_STATES.resolved;
    } catch (error) {
      console.error(error);
      results = [];
      this.cancel();
      this.state = NODE_STATES.failed;
    }

    if (flag !== this.fetchFlag) return new Promise(() => {});

    if (typeof results === "function" && results[IS_RENDER]) {
      this.updateHandler = results;
      results = results();
    }

    this.callOut(this.id, DIFF_TYPES.update, { state: this.state });

    return results;
  }
}
