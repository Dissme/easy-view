export function createFragment(id) {
  const comment = document.createComment(id);
  comment._fragment = true;
  comment.children = [];
  comment.id = id;
  Object.assign(comment, mix);
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
    let index = this.children.findIndex(n => n === child);
    if (index === -1) index = this.children.length;
    this.children.splice(index, 0, node);
    this.parentNode.insertBefore(node, child.startTag ?? child);
  }
};
