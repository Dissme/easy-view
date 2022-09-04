import { IS_RENDER, Node } from "./node";

export function splitProps(props) {
  const result = {
    children: [],
    eventHandlers: {},
    props: {},
    key: null
  };

  Object.keys(props).forEach(key => {
    if (key === "children") {
      result.children = props[key];
    } else if (key === "key") {
      result.key = props[key];
    } else if (/^on-/.test(key)) {
      result.eventHandlers[key.replace(/^on-/, "")] = props[key];
    } else {
      result.props[key] = props[key];
    }
  });

  return result;
}

function generateNodes(nodes) {
  return nodes.map(node => {
    if (typeof node === "function" && node[IS_RENDER])
      return generateNodes([node()]);
    if (Array.isArray(node)) return generateNodes(node);
    return node;
  });
}
export function flatNodes(nodes) {
  return generateNodes(nodes)
    .flat(Infinity)
    .filter(node => node !== null && node !== undefined);
}

export function sameObj(objA, objB) {
  if (objA === objB) return true;
  if (typeof objA !== typeof objB) return false;
  if (typeof objA !== "object") return false;
  if (!objA || !objB) return false;
  const keys = Object.keys({ ...objA, ...objB });
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (!sameObj(objA[key], objB[key])) return false;
  }
  return true;
}

export function sameNode(nodeA, nodeB) {
  if (nodeA === nodeB) return true;
  if (!nodeA || !nodeB) return false;
  return nodeA.tag + "" === nodeB.tag + "" && nodeA.key === nodeB.key;
}

export function sameChildren(nodeA, nodeB) {
  if (nodeA == nodeB) return true;
  if (!nodeA || !nodeB) return false;
  const childrenA = nodeA?.children ?? [];
  const childrenB = nodeB?.children ?? [];

  let len = childrenA.length;
  if (childrenB.length !== len) return false;
  while (len-- > 0) {
    const a = childrenA[len];
    const b = childrenB[len];
    if (a === b) continue;
    if (a instanceof Node && b instanceof Node) {
      if (
        !sameNode(childrenA[len], childrenB[len]) ||
        !sameObj(childrenA[len].props, childrenB[len].props) ||
        !sameObj(childrenA[len].eventHandlers, childrenB[len].eventHandlers) ||
        !sameChildren(childrenA[len], childrenB[len])
      )
        return false;
    } else if (a instanceof Node || b instanceof Node || !sameObj(a, b)) {
      return false;
    }
  }
  return true;
}

export function debounce(fn) {
  let timer = null;
  return function () {
    if (!timer) {
      timer = Promise.resolve().then(() => {
        fn.apply(this);
        timer = null;
      });
    }
  };
}
