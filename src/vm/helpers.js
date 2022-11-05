import { IS_RENDER, Node } from "./node";

export function splitProps(props) {
  const result = {
    children: [],
    eventHandlers: {},
    props: {}
  };

  Object.keys(props).forEach(key => {
    if (key === "children") {
      result.children = props[key];
    } else if (/^on-/.test(key)) {
      result.eventHandlers[key.replace(/^on-/, "")] = props[key];
    } else if (/^before-/.test(key)) {
      result.eventHandlers[key.replace(/^before-/, "") + "_capture"] =
        props[key];
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
    if (node instanceof Node)
      return new node.constructor({
        tag: node.tag,
        props: { ...node.props },
        children: [...node.children],
        $scope: new Set(node.$scope.values()),
        key: node.key,
        eventHandlers: { ...node.eventHandlers }
      });
    return node;
  });
}

export function flatNodes(nodes) {
  return generateNodes(nodes)
    .flat(Infinity)
    .filter(node => !!node);
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
  return (
    nodeA + "" === nodeB + "" &&
    nodeA.tag === nodeB.tag &&
    nodeA.key === nodeB.key &&
    nodeA.text === nodeB.text
  );
}

export function sameChildren(childrenA, childrenB) {
  if (childrenA === childrenB) return true;
  if (childrenA.length !== childrenB.length) return false;
  let len = childrenA.length;
  while (len--) {
    const nodeA = childrenA[len];
    const nodeB = childrenB[len];
    if (
      sameNode(nodeA, nodeB) &&
      sameObj(nodeA.props, nodeB.props) &&
      sameObj(nodeA.eventHandlers, nodeB.eventHandlers) &&
      sameChildren(nodeA.children, nodeB.children)
    )
      continue;
    return false;
  }
  return true;
}

export function debounce(fn) {
  let timer = null;
  return function (...args) {
    if (!timer) {
      timer = Promise.resolve().then(() => {
        fn.apply(this, args);
        timer = null;
      });
    }
    return timer;
  };
}
