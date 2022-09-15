import { Channel } from "../common/channel";
import { render } from "../common/render";
import { DIFF_TYPES, EVENT_TYPES } from "../common/constants";
import EventProxy from "./eventProxy";
import { createFragment, stateClass } from "./fragment";

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
        ele.className = stateClass[state];
      } else {
        ele = document.createElement(tag);
        Object.keys(props).forEach(key => {
          ele.setAttribute(key, props[key]);
        });
      }
      const [, parentId] = id.match(/(.*)?,([^,]+)$/) ?? [];
      insert(parentId, id, ele);

      cache[id] = ele;
      eventHandlers?.forEach?.(evtName => {
        if (!events[evtName]) events[evtName] = [];
        events[evtName].push(id);
      });
    },
    [DIFF_TYPES.delete]({ id }) {
      const parent = nodeCache[id.replace(/,\d+$/, "")];
      if (parent?._fragment) {
        const index = parent.children.findIndex(n => n === nodeCache[id]);
        if (index >= 0) parent.children.splice(index, 1);
      }
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

      if (cur._fragment && stateClass[state]) cur.className = stateClass[state];
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
    [DIFF_TYPES.connect]({ payload: nodes }) {
      nodes.forEach(
        ({ id, _text, text, _fragment, tag, props, state, eventHandlers }) => {
          let ele;
          if (_text) {
            ele = document.createTextNode(text);
          } else if (_fragment) {
            ele = createFragment(id);
            stateClass[state] && (ele.className = stateClass[state]);
          } else {
            ele = document.createElement(tag);
            Object.keys(props).forEach(key => {
              ele.setAttribute(key, props[key]);
            });
          }
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
    frag.$ele = cur;
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
  let inited = false;
  const nodeCache = {};
  const channel = new Channel();
  const eventProxy = new EventProxy(container, body => {
    channel.postMessage(EVENT_TYPES.call, body);
  });
  channel.register(EVENT_TYPES.patch, patchs => {
    if (patchs[0].type === DIFF_TYPES.connect) inited = true;
    if (inited) applyPatchs(patchs, container, nodeCache, eventProxy);
  });
  channel.connect(port);
  return channel;
}

export function mount(node, container) {
  const { port1, port2 } = new MessageChannel();
  mountFromPort(port1, container);
  render(node)(port2);
}

export { setFormater } from "./eventProxy";
export { render };
