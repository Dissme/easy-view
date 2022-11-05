export function createFragment(id, tag) {
  const comment = document.createComment(`${tag} _eid="${id}" /`);

  comment._fragment = true;
  comment.children = [];
  comment.id = id;
  comment.tag = tag;
  Object.assign(comment, mix);
  return comment;
}

const mix = {
  setAttribute(key, value) {
    if (key === "_eid") {
      this.id = value;
    }
    if (this.startTag) {
      this.startTag.textContent = `${this.tag} _eid="${this.id}"`;
      this.textContent = `/${this.tag}`;
    } else {
      this.textContent = `${this.tag} _eid="${this.id}" /`;
    }
  },

  getAttribute(key) {
    if (key === "_eid") return this.id;
  },

  append(...children) {
    if (!this.startTag) {
      this.startTag = document.createComment(`${this.tag} _eid="${this.id}"`);
      this.textContent = `/${this.tag}`;
      this.parentNode.insertBefore(this.startTag, this);
    }
    const frag = document.createDocumentFragment();

    children.forEach(child => {
      frag.append(child);
      this.children.push(child.$ele ?? child);
    });

    this.parentNode.insertBefore(frag, this);
  },

  remove() {
    this.children.forEach(child => {
      child.remove();
    });
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
  },

  replaceChildren() {
    this.children.forEach(child => {
      child.remove();
    });
    this.children = [];
  }
};
