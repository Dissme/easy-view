import { Channel } from "../common/channel";
import { render } from "../common/render";
import { CONNECTOR_TYPES, DIFF_TYPES, EVENT_TYPES } from "../common/constants";
import { EventProxy } from "./eventProxy";
import { createFragment } from "./fragment";
import { Connector } from "../common/connector";
import "./microComponent";

let microLoader = props => {
  return new Worker(props.url);
};

export function onLoadMicro(fn) {
  microLoader = fn;
}

function filterProps(props) {
  if (!props) return;
  Object.keys(props).forEach(prop => {
    if (prop === "className") {
      props["class"] = props[prop];
      props[prop] = false;
    }
    if (!props[prop]) Reflect.deleteProperty(props, prop);
  });
}

function createElementNs(tag, parent) {
  const NSs = {
    svg: "http://www.w3.org/2000/svg",
    browser: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
    math: "http://www.w3.org/1998/Math/MathML"
  };
  return document.createElementNS(
    NSs[tag] || parent?.namespaceURI || "http://www.w3.org/1999/xhtml",
    tag
  );
}

function applyPatchs(patchs, container, nodeCache, eventProxy) {
  const patchHandlers = {
    [DIFF_TYPES.create]({
      id,
      payload: { _text, text, _fragment, tag, props, eventHandlers, _micro }
    }) {
      filterProps(props);
      let ele;
      const [, parentId] = id.match(/(.*)?,([^,]+)$/) ?? [];

      if (_text) {
        ele = document.createTextNode(text);
      } else if (_micro) {
        ele = document.createElement("micro-component");
        Object.keys(props).forEach(key => {
          ele.setAttribute(key, props[key]);
        });
        const port = microLoader(props);
        if (port) {
          ele.destroyCallback = mountFromPort(port, ele.shadowRoot);
        }
      } else if (_fragment) {
        ele = createFragment(id, tag);
      } else {
        ele = createElementNs(tag, nodeCache[parentId]);
        Object.keys(props).forEach(key => {
          ele.setAttribute(key, props[key]);
        });
      }
      insert(parentId, id, ele);

      nodeCache[id] = ele;
      eventHandlers?.forEach?.(evtName => {
        eventProxy.on(evtName, id, ele);
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
      Object.keys(nodeCache).forEach(key => {
        if (!reg.test(key)) return;
        eventProxy.off("*", key);
        Reflect.deleteProperty(nodeCache, key);
      });
    },
    [DIFF_TYPES.update]({ id, payload: { props, eventHandlers } }) {
      filterProps(props);
      const cur = nodeCache[id];
      if (props && cur.setAttribute) {
        const attrs = cur.getAttributeNames();
        Object.keys(props).forEach(key => {
          const index = attrs.indexOf(key);
          if (index >= 0) attrs[index] = null;
          cur.setAttribute(key, props[key]);
          if (key === "value") cur.value = props[key];
        });
        attrs.forEach(
          attr => attr && attr !== "_eid" && cur.removeAttribute(attr)
        );
      }

      if (eventHandlers) {
        const es = eventProxy.getEventNames(id);
        eventHandlers.forEach(evtName => {
          if (es[evtName]) return Reflect.deleteProperty(es, evtName);
          eventProxy.on(evtName, id, cur);
        });
        Object.keys(es).forEach(evtName => {
          eventProxy.off(evtName, id);
        });
      }
    },
    [DIFF_TYPES.move]({ id, payload: { id: tid } }) {
      const cur = nodeCache[id];
      const [, parentId] = id.match(/(.*)?,([^,]+)$/) ?? [];
      const reg = new RegExp(`^${id}`);
      insert(parentId, tid, cur);

      Object.keys(nodeCache).forEach(key => {
        if (!reg.test(key)) return;
        const t = key.replace(reg, tid);
        nodeCache[key].setAttribute?.("_eid", t);
        nodeCache[t] = nodeCache[key];
        Reflect.deleteProperty(nodeCache, key);
        eventProxy.move(key, t);
      });
    }
  };

  patchs.forEach(patch => {
    patchHandlers[patch.type]?.(patch);
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

export function mountFromPort(port, container = document.body) {
  let inited = false;
  let nodeCache = {};
  const connector = Connector.getInstance(port);
  const channel = new Channel();
  const eventProxy = new EventProxy(container, body => {
    channel.postMessage(EVENT_TYPES.call, body);
  });

  channel.register(EVENT_TYPES.initial, patchs => {
    if (inited) return;
    inited = true;
    applyPatchs(patchs, container, nodeCache, eventProxy);
  });

  channel.register(EVENT_TYPES.patch, patchs => {
    if (!inited) return;
    applyPatchs(patchs, container, nodeCache, eventProxy);
  });

  channel.connect(port);
  connector.postMessage(CONNECTOR_TYPES.connector, EVENT_TYPES.connect);

  function destroy() {
    inited = false;
    connector.postMessage(CONNECTOR_TYPES.connector, EVENT_TYPES.destroy);
    channel.disconnect();
    eventProxy.destroy();
    container.replaceChildren();
    nodeCache = null;
  }
  return destroy;
}

export function mount(node, container) {
  const { port1, port2 } = new MessageChannel();
  render(node)(port2);
  return mountFromPort(port1, container);
}

export { use } from "./eventProxy";
