import { flatNodes, splitProps } from "./helpers";
import { MicroComponent } from "./MicroComponents";
import { Node } from "./node";

export { Fragment, defineRender } from "./node";
export { MicroComponent };

export function jsxs(tag, options, key) {
  if (typeof tag !== "function" && typeof tag !== "string") {
    throw new TypeError(`意外的tag类型<${tag}>`);
  }

  let { children, eventHandlers, props } = splitProps(options);

  children = flatNodes(children);

  return new Node({ tag, props, children, eventHandlers, key });
}

export function jsx(tag, options, key) {
  options.children = [options.children];
  return jsxs(tag, options, key);
}

export { render } from "../common/render";
export { MethodChannel } from "../common/channel";
