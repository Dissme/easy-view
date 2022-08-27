import { flatNodes, splitProps } from "./utils/helpers";
import { Node } from "./vm/node";

export { Fragment, defineRender } from "./vm/node";

export function jsxs(tag, options) {
  if (typeof tag !== "function" && typeof tag !== "string") {
    throw new TypeError(`意外的tag类型<${tag}>`);
  }
  let { children, eventHandlers, props, key } = splitProps(options);

  children = flatNodes(children);

  return new Node({ tag, props, children, eventHandlers, key });
}

export function jsx(tag, options) {
  options.children = [options.children];
  return jsxs(tag, options);
}
