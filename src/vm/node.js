import { DIFF_TYPES, EVENT_TYPES } from "../common/constants";
import { debounce, flatNodes } from "./helpers";
import { Hook } from "../common/hook";
import phase from "./phase";
import { diff } from "./diff";

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
    if (!props) return;
    const validTypes = ["boolean", "string", "number"];
    return Object.keys(props).reduce(
      (obj, key) =>
        validTypes.includes(typeof props[key])
          ? { ...obj, [key]: props[key] }
          : obj,
      {}
    );
  }

  static node2obj(node) {
    if (node instanceof Node) {
      node = {
        id: node.id,
        tag: typeof node.tag === "function" ? node.tag.name : node.tag,
        props: this.filterProps(node.props),
        eventHandlers: node.boundedEvents,
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
  destroyed = false;
  $scope = new Set();
  index = 0;
  hook = new Hook();
  updateHandler;

  channel;
  patchs = [];

  tag = Fragment;
  key;
  children = [];
  props = {};
  eventHandlers = {};
  results = [];

  get id() {
    return `${this.parent?.id ?? ""},${this.index}`;
  }

  get boundedEvents() {
    return [
      ...new Set(
        this.hook.boundedEvents
          .map(evtName => evtName.replace(/_capture$/, ""))
          .filter(
            evtName => !["update", "destroy", "__fetch__"].includes(evtName)
          )
      )
    ];
  }

  constructor(initails) {
    Object.assign(this, initails);
    this.hook.on("update", this.update);
    this.hook.on("destroy", this.destroy);
    this.bindEventHandlers();
  }

  update = force => {
    phase.add(this, force);
  };

  destroy = () => {
    phase.delete(this);
    this.destroyed = true;
    this.parent = null;
    this.$scope.clear();
    this.channel = null;
    this.offBindEventHandlers();
    this.results.forEach(node => node.emit?.({ type: "destroy" }));
  };

  userHook = new Proxy(
    {},
    {
      get: (target, type) => {
        type = type.replace(/_capture$/, "");

        const updateEvents = () => {
          this.callOut(this.id, DIFF_TYPES.update, {
            eventHandlers: this.boundedEvents
          });
        };

        const dispatch = detail => {
          this.emit({ type, detail });
        };
        const before = cb => {
          this.hook.on(`${type}_capture`, cb);
          updateEvents();
        };

        Object.assign(before, {
          once: cb => {
            this.hook.once(`${type}_capture`, cb);
            updateEvents();
          },
          off: cb => {
            this.hook.off(`${type}_capture`, cb);
            updateEvents();
          }
        });

        Object.assign(dispatch, {
          on: cb => {
            this.hook.on(type, cb);
            updateEvents();
          },
          once: cb => {
            this.hook.once(type, cb);
            updateEvents();
          },
          off: cb => {
            this.hook.off(type, cb);
            updateEvents();
          },
          before
        });

        return dispatch;
      }
    }
  );

  callInital(cid) {
    if (!this.channel) return;
    const nodes = [];
    const rs = [this];
    while (rs.length) {
      const cur = rs.shift();
      rs.push(...(cur.results ?? []));
      nodes.push(Node.node2obj(cur));
    }

    this.post().finally(() => {
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
    });
  }

  emit(e) {
    const isUserEvt = !e.detail?._eid;
    const shouldCall = new RegExp(`^${this.id}`).test(e.detail?._eid);
    if (!isUserEvt && !shouldCall) return;
    const eventName = e.type.replace(/_capture$/, "");
    const captureName = `${eventName}_capture`;

    if (e.detail?.cancelBubble ? this.id === e.detail?._eid : !e.cancelBubble) {
      e = this.hook.dispatch(captureName, e.detail);
    }

    if (!isUserEvt) {
      this.results.forEach(node => {
        e = node.emit?.(e) ?? e;
      });
    }

    if (e.detail?.cancelBubble ? this.id === e.detail?._eid : !e.cancelBubble) {
      e = this.hook.dispatch(eventName, e.detail);
    }

    if (!e.defaultPrevented && !["update", "destroy"].includes(eventName)) {
      if (e.results.length) {
        this.update();
        e.results.forEach(p => {
          p?.then?.(() => {
            this.$scope.forEach(node => {
              if (node.destroyed) this.$scope.delete(node);
              else node.emit({ type: "update" });
            });
          });
        });
        this.$scope.forEach(node => {
          if (node.destroyed) this.$scope.delete(node);
          else node.emit({ type: "update" });
        });
      }
    }

    return e;
  }

  setResults(results) {
    this.results = flatNodes([results]).map((result, index) => {
      if (result instanceof Node) {
        result.parent = this;
        result.index = index;
        result.$scope.add(this);
        const children = [...result.children];
        while (children.length) {
          const child = children.pop();
          if (child.children?.length) children.push(...child.children);
          child?.$scope?.add?.(this);
        }
      } else {
        result = {
          id: `${this.id},${index}`,
          index,
          text: result + "",
          _text: true
        };
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

    this.post();
  }

  post = debounce(() => {
    if (this.channel && this.patchs.length) {
      this.channel.postMessage(EVENT_TYPES.patch, this.patchs);
    }
    this.patchs = [];
  });

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

  diff(force) {
    if (this.destroyed) return;
    const curResults = [...this.results];

    let result = this.children;
    if (typeof this.tag === "function") {
      result = this.fetch();
    }
    if (this.results === result) return;
    this.setResults(result);
    const nextResults = [...this.results];
    const { updateds, moves } = diff(curResults, nextResults);
    updateds.forEach(update => {
      if (update.diffrent) {
        this.callOut(update.id, DIFF_TYPES.update, {
          props: Node.filterProps(update.props),
          eventHandlers: update.eventHandlers
        });
      }
      this.results[update.curNode.index] = update.curNode;
      if (update.diffrent || force) update.curNode.emit?.({ type: "update" });
    });
    curResults.forEach(item => {
      if (item) {
        this.callOut(item.id, DIFF_TYPES.delete);
        item.emit?.({ type: "destroy" });
      }
    });
    moves.forEach(({ from, to }) => {
      this.callOut(`${this.id},${from}`, DIFF_TYPES.move, {
        id: `${this.id},${to}`
      });
    });
    nextResults.forEach(item => {
      if (item) {
        this.callOut(item.id, DIFF_TYPES.create, Node.node2obj(item));
        if (item instanceof Node) {
          phase.firstPaint = true;
          item.channel = this.channel;
          item.emit({ type: "update" });
        }
      }
    });
  }

  fetch() {
    const caller =
      this.updateHandler ??
      this.tag.bind(null, this.props, this.children, this.userHook);

    this.hook.once("__fetch__", caller);
    let e = this.hook.dispatch("__fetch__");
    let results = e.result(caller);
    if (results instanceof Error) {
      results = this.results ?? [];
    }

    if (typeof results === "function" && results[IS_RENDER]) {
      this.updateHandler = results;
      results = results();
    }

    return results;
  }
}
