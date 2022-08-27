import { render } from "../vm";
import { DIFF_TYPES, STATES } from "../vm/node";
import EventProxy from "./eventProxy";
import { createFragment } from "./fragment";

const stateClass = {
  [STATES.fetching]: "fetching",
  [STATES.resolved]: "resolved",
  [STATES.failed]: "failed"
};

function setStateClass(element, state) {
  if (!Reflect.has(element, "className") || state == undefined) return;
  state = stateClass[state];
  const classList = element.className.split(" ");
  const reg = /^(fetching|resolved|failed)$/;
  let replaced = false;
  classList.forEach((className, index) => {
    if (!reg.test(className)) return;
    classList[index] = state;
    replaced = true;
  });
  if (!replaced) classList.push(state);
  element.className = classList.join(" ");
}

function applyPatchs(patchs, container, nodeCache, eventProxy) {
  const cache = {};
  const events = {};

  const patchHandlers = {
    [DIFF_TYPES.create]({
      id,
      payload: { _text, text, _fragment, tag, props, state, eventHandlers }
    }) {
      let ele;
      if (_text) {
        ele = document.createTextNode(text);
      } else if (_fragment) {
        ele = createFragment(id);
      } else {
        ele = document.createElement(tag);
        Object.keys(props).forEach(key => {
          ele.setAttribute(key, props[key]);
        });
      }
      setStateClass(ele, state);
      const [, parentId] = id.match(/(.*)?,([^,]+)$/) ?? [];

      insert(parentId, id, ele);
      cache[id] = ele;
      eventHandlers?.forEach?.(evtName => {
        if (!events[evtName]) events[evtName] = [];
        events[evtName].push(id);
      });
    },
    [DIFF_TYPES.delete]({ id }) {
      nodeCache[id].remove();
      const reg = new RegExp(`^${id}`);
      eventProxy.offWithRegExp(reg);
      Object.keys(nodeCache).forEach(key => {
        if (!reg.test(key)) return;
        Reflect.deleteProperty(nodeCache, key);
      });
    },
    [DIFF_TYPES.update]({
      id,
      payload: { state, props, eventHandlers, text }
    }) {
      const cur = nodeCache[id];
      if (cur instanceof Text) cur.textContent = text;
      if (props && cur.setAttribute) {
        const attrs = cur.getAttributeNames();
        Object.keys(props).forEach(key => {
          const index = attrs.indexOf(key);
          if (index >= 0) attrs[index] = null;
          cur.setAttribute(key, props[key]);
        });
        attrs.forEach(
          attr => attr && attr !== "class" && cur.removeAttribute(attr)
        );
      }
      if (eventHandlers) {
        eventProxy.off("*", id);
        eventHandlers.forEach(evtName => {
          if (!events[evtName]) events[evtName] = [];
          events[evtName].push(id);
        });
      }

      setStateClass(cur, state);
    },
    [DIFF_TYPES.move]({ id, payload: { id: tid } }) {
      const cur = nodeCache[id];

      const [, parentId] = id.match(/(.*)?,([^,]+)$/) ?? [];

      insert(parentId, tid, cur);

      const reg = new RegExp(`^${id}`);
      const removed = eventProxy.offWithRegExp(reg);
      Object.keys(removed).forEach(evt => {
        (events[evt] || (events[evt] = [])).push(...removed[evt]);
      });
      Object.keys(nodeCache).forEach(key => {
        if (!reg.test(key)) return;
        const t = key.replace(reg, tid);
        nodeCache[key].setAttribute?.("_eid", t);
        cache[t] = nodeCache[key];
        Reflect.deleteProperty(nodeCache, key);
      });
    },
    [DIFF_TYPES.connect]({ payload: { nodes } }) {
      nodes.forEach(
        ({ id, _text, text, _fragment, tag, props, state, eventHandlers }) => {
          let ele;
          if (_text) {
            ele = document.createTextNode(text);
          } else if (_fragment) {
            ele = createFragment(id);
          } else {
            ele = document.createElement(tag);
            Object.keys(props).forEach(key => {
              ele.setAttribute(key, props[key]);
            });
          }
          setStateClass(ele, state);
          const [, parentId] = id.match(/(.*)?,([^,]+)$/) ?? [];

          insert(parentId, id, ele);
          nodeCache[id] = ele;
          eventHandlers?.forEach?.(evtName => {
            if (!events[evtName]) events[evtName] = [];
            events[evtName].push(id);
          });
        }
      );
    }
  };

  patchs.forEach(patch => {
    patchHandlers[patch.type]?.(patch);
  });

  Object.assign(nodeCache, cache);
  Object.keys(events).forEach(evt => {
    events[evt].forEach(id => {
      eventProxy.on(evt, id);
    });
  });

  function moveFragment(cur) {
    const frag = document.createDocumentFragment();
    if (cur._fragment) {
      if (cur.startTag) frag.append(cur.startTag);
      cur.children.forEach(child => {
        frag.append(moveFragment(child));
      });
    }
    frag.append(cur);
    return frag;
  }

  function insert(parentId, tid, cur) {
    const parent = nodeCache[parentId] ?? container;
    const reg = /(.*)?,([^,]+)$/;
    const [, , tindex] = tid.match(reg);
    cur.setAttribute?.("_eid", tid);
    const siblingId = Object.keys(nodeCache).find(id => {
      const [, pid, index] = id.match(reg);
      return pid === parentId && +index >= +tindex && nodeCache[id];
    });
    if (cur._fragment) {
      cur = moveFragment(cur);
    }
    if (siblingId) {
      parent.insertBefore(
        cur,
        nodeCache[siblingId].startTag ?? nodeCache[siblingId]
      );
    } else {
      parent.append(cur);
    }
  }
}

export function mountFromPort(port, container) {
  let v = null;
  const waitBuffer = {};
  const nodeCache = {};

  const callOut = body =>
    port.postMessage({
      body,
      version: v
    });

  const eventProxy = new EventProxy(container, callOut);

  port.onmessage = ({ data }) => {
    const { body, version, lastVersion } = data;
    if (body === undefined || body === null) return (v = version);
    if (body === "connect") return (v = version);
    waitBuffer[lastVersion] = data;
    if (v) clearBuffer();
  };

  function clearBuffer() {
    const versions = Object.keys(waitBuffer).sort((v1, v2) => {
      const [t1, c1] = v1.split("-");
      const [t2, c2] = v2.split("-");
      const t = t1 - t2;
      return t || c1 - c2;
    });
    const [t, c] = v.split("-");
    while (versions.length) {
      const version = versions.pop();
      const [t2, c2] = version.split("-");
      if (+t2 < +t || (t2 === t && +c2 < +c)) {
        Reflect.deleteProperty(waitBuffer, version);
        continue;
      }
      if (v !== version) return;
      const cur = waitBuffer[version];
      applyPatchs(cur.body, container, nodeCache, eventProxy);
      v = cur.version;
      Reflect.deleteProperty(waitBuffer, version);
    }
  }
}

export function mount(node, container) {
  const { port1, port2 } = new MessageChannel();
  mountFromPort(port1, container);
  render(node)(port2);
}
