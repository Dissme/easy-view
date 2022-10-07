import { flatNodes, splitProps } from "./helpers";
import { Micro, MicroComponent } from "./micro";
import { Node } from "./node";

export { Fragment, defineRender } from "./node";
export { MicroComponent };

export function jsxs(tag, options, key) {
  if (typeof tag !== "function" && typeof tag !== "string") {
    throw new TypeError(`意外的tag类型<${tag}>`);
  }

  const Constructor = tag === MicroComponent ? Micro : Node;

  let { children, eventHandlers, props } = splitProps(options);

  children = flatNodes(children);

  return new Constructor({ tag, props, children, eventHandlers, key });
}

export function jsx(tag, options, key) {
  options.children = [options.children];
  return jsxs(tag, options, key);
}
