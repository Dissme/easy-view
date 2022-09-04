import { STATES } from "../vm/node";

export const stateClass = {
  [STATES.fetching]: "e-fetching",
  [STATES.resolved]: "e-resolved",
  [STATES.failed]: "e-failed"
};

const classReg = new RegExp(`${Object.values(stateClass).join("|")}|$`);

export function createFragment(id) {
  const comment = document.createComment(id);

  comment._fragment = true;
  comment.children = [];
  comment.id = id;
  Object.assign(comment, mix);
  let className = "";
  Object.defineProperty(comment, "className", {
    get() {
      return className;
    },
    set(v) {
      comment.children.forEach(child => {
        child.className = (child.className ?? "").replace(classReg, v);
      });
    }
  });
  return comment;
}

const mix = {
  setAttribute(key, value) {
    if (key === "_eid") {
      this.id = value;
      this.textContent = `/_eid="${value}"`;
      if (this.startTag) this.startTag.textContent = `/_eid="${value}"`;
    }
  },

  append(...children) {
    if (!this.startTag) {
      this.startTag = document.createComment(this.textContent.slice(1));
      this.parentNode.insertBefore(this.startTag, this);
    }
    const frag = document.createDocumentFragment();

    children.forEach(child => {
      frag.append(child);
      this.children.push(child);
      child.className = this.className;
    });

    this.parentNode.insertBefore(frag, this);
  },

  remove() {
    this.children.forEach(child => child.remove());
    this.children = [];
    this.startTag?.remove();
    this.constructor.prototype.remove.call(this);
  },

  insertBefore(node, child) {
    let oldIndex = this.children.findIndex(n => n === (node.$ele ?? node));
    if (oldIndex >= 0) this.children.splice(oldIndex, 1);
    let index = this.children.findIndex(n => n === child);
    if (index === -1) index = this.children.length;
    this.children.splice(index, 0, node.$ele ?? node);
    this.parentNode.insertBefore(node, child.startTag ?? child);
  }
};
