import {
  debounce,
  flatNodes,
  sameChildren,
  sameNode,
  sameObj
} from "../utils/helpers";

export const DIFF_TYPES = {
  create: 1,
  update: 2,
  delete: 3,
  move: 4
};

export const IS_RENDER = Symbol("IS_RENDER");
export function defineRender(fn) {
  fn[IS_RENDER] = true;
  return fn;
}

export function Fragment(props, children = []) {
  return children;
}

export const STATES = {
  fetching: 1,
  resolved: 2,
  failed: 3
};

export class Node {
  /**
   * @type { <T> }
   * @param { T } node
   * @returns { T extends Node ? {
   *  id: string,
   *  state: number,
   *  tag: string,
   *  props: Record<string, any>,
   *  eventHandlers: string[],
   *  version: number,
   *  _fragment: boolean,
   * } :  T }
   */
  static d2o(node) {
    const validTypes = ["boolean", "string", "number", "undefined"];
    if (node instanceof Node) {
      return {
        id: node.id,
        state: node.state,
        tag: typeof node.tag === "function" ? null : node.tag,
        props: Object.keys(node.props).reduce(
          (props, key) =>
            validTypes.includes(typeof node.props[key])
              ? { ...props, [key]: node.props[key] }
              : props,
          {}
        ),
        eventHandlers: Object.keys(node.eventHandlers),
        _fragment: typeof node.tag === "function"
      };
    }

    return node;
  }

  #fetchFlag = {};
  watcher = null;

  id = "";
  key = null;
  tag = Fragment;
  props = {};
  children = [];
  eventHandlers = {};
  results = null;
  state = STATES.resolved;
  updateHandler = null;

  constructor(initails) {
    Object.assign(this, initails);
  }

  callInitail(cid) {
    const nodes = [];
    const rs = [this];
    while (rs.length) {
      const cur = rs.shift();
      rs.push(...(cur.results ?? []));
      nodes.push(Node.d2o(cur));
    }
    this.callOut(this.id, DIFF_TYPES.connect, {
      cid,
      nodes
    });
  }

  setResults(results) {
    this.results = flatNodes([results]).map((result, index) => {
      const id = `${this.id},${index}`;
      if (result instanceof Node) {
        if (result.id && result.id !== id) result.tid = id;
        else result.id = id;
        result.watch(this.watcher);
      } else {
        result = { id, text: result, _text: true };
      }
      return result;
    });
  }

  emit(e) {
    const canCall = e._userEvt || new RegExp(`^${this.id}`).test(e.id);

    let called = false;
    let isCanceled = false;
    const next = isProgration => {
      if (isProgration === false) isCanceled = true;
      if (called || isCanceled) return;
      called = true;
      if (!e._userEvt) this.results?.forEach(node => node.emit?.(e));
      this.update();
    };
    if (canCall) {
      const result = this.eventHandlers[e.type]?.(e, next);
      result?.then(() => this.update());
      if (!called && !isCanceled) next();
      return result;
    }
  }

  watch(callBack) {
    this.watcher = callBack;
  }

  offWatch() {
    this.watcher = null;
  }

  callOut(id, type, payload) {
    this.watcher({ id, type, payload });
  }

  cancel() {
    this.#fetchFlag = null;
    this.state = STATES.resolved;
    this.results.forEach(node => node.cancel?.());
  }

  update = debounce(() => {
    if (this.state === STATES.fetching) return;
    this.diff(true);
  });

  async diff(isUpdate) {
    const lastResults = [...(this.results ?? [])];
    const nextDiffs = [];
    const moves = [];

    if (this.results && this.updateHandler && isUpdate) {
      this.setResults(this.updateHandler());
    } else {
      await this.fetch();
    }

    const curResults = [...this.results];
    const ks = {};
    curResults.forEach((node, index) => {
      if (node.key && !node.tid) {
        ks[node.key] = index;
      }
    });

    let lastIndex = 0;
    let curIndex = 0;

    while (lastIndex < lastResults.length && curIndex < curResults.length) {
      const last = lastResults[lastIndex];

      if (!last) {
        lastIndex++;
        continue;
      }

      if (last.tid) {
        moves.push({ from: last.id, to: last.tid });
        lastResults[lastIndex] = null;
        curResults[last.tid.match(/,(\d+)$/)[1]] = null;
        const reg = new RegExp(`^${last.id}`);
        const rs = last.results ?? [];

        while (rs.length) {
          const r = rs.pop();
          r.id = r.id.replace(reg, last.tid);
          if (r.results) rs.push(...r.results);
        }

        last.id = last.tid;
        last.tid = null;
        lastIndex++;
        continue;
      }

      let cur = curResults[curIndex];
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

      let index = curIndex;
      if (last.key && ks[last.key]) {
        index = ks[last.key];
        cur = curResults[index];
      }

      if (!sameNode(last, cur)) {
        lastIndex++;
        continue;
      }

      let isDiffrent = false;

      if (!sameObj(last.props, cur.props)) {
        this.callOut(last.id, DIFF_TYPES.update, { props: cur.props });
        Object.keys({
          ...last.props,
          ...cur.props
        }).forEach(key => {
          last.props[key] = cur.props[key];
        });
        isDiffrent = true;
      }

      if (!sameObj(last.eventHandlers, cur.eventHandlers)) {
        this.callOut(last.id, DIFF_TYPES.update, {
          eventHandlers: cur.eventHandlers
        });
        Object.keys({
          ...last.eventHandlers,
          ...cur.eventHandlers
        }).forEach(key => {
          last.eventHandlers[key] = cur.eventHandlers[key];
        });
        isDiffrent = true;
      }

      if (!sameChildren(last, cur)) {
        last.children.splice(0, last.children.length, ...cur.children);
        isDiffrent = true;
      }

      if (last.id !== cur.id) {
        moves.push({ from: last.id, to: cur.id });
        last.id = cur.id;
        const reg = new RegExp(`^${last.id}`);
        const rs = last.results ?? [];

        while (rs.length) {
          const r = rs.pop();
          r.id = r.id.replace(reg, cur.id);
          if (r.results) rs.push(...r.results);
        }

        last.id = cur.id;
      }

      this.results[index] = last;
      curResults[index] = null;
      lastResults[lastIndex] = null;

      if (isDiffrent) nextDiffs.push(() => last.diff(true));
    }

    curResults.forEach(item => {
      if (item) {
        this.callOut(item.id, DIFF_TYPES.create, Node.d2o(item));
        if (item.diff) nextDiffs.push(() => item.diff());
      }
    });

    moves.forEach(({ from, to }) => {
      this.callOut(from, DIFF_TYPES.move, { id: to });
    });

    lastResults.forEach(item => {
      if (item) {
        item.cancel?.();
        this.callOut(item.id, DIFF_TYPES.delete);
      }
    });

    Promise.resolve().then(() => {
      nextDiffs.forEach(fn => fn());
    });
  }

  createUserEvtHanlers() {
    return Object.keys(this.eventHandlers).reduce(
      (handlers, evtName) => ({
        ...handlers,
        [evtName]: (...args) =>
          this.emit({ _userEvt: true, type: evtName }, ...args)
      }),
      {}
    );
  }

  async fetch() {
    if (this.state === STATES.fetching) this.cancel();

    const flag = {};
    this.#fetchFlag = flag;
    this.state = STATES.fetching;
    this.callOut(this.id, DIFF_TYPES.update, { state: this.state });

    try {
      let results =
        typeof this.tag !== "function"
          ? this.children
          : await this.tag(
              this.props,
              this.children,
              this.createUserEvtHanlers(),
              this.update
            );
      if (flag !== this.#fetchFlag) return new Promise(() => {});
      if (typeof results === "function" && results[IS_RENDER]) {
        this.updateHandler = results;
        results = results();
      }

      this.setResults(results);
      this.state = STATES.resolved;
    } catch (error) {
      if (import.meta.env.MODE === "development") console.error(error);
      if (flag !== this.#fetchFlag) return new Promise(() => {});
      if (!this.results) this.results = [];
      this.cancel();
      this.state = STATES.failed;
    }
    this.callOut(this.id, DIFF_TYPES.update, { state: this.state });
  }
}
