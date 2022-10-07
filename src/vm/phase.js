class Phase {
  firstPaint = true;
  currentPhase = new Map();
  nextPase = new Map();
  timer;
  running = false;
  circleTimes = new WeakMap();

  add(node, force) {
    if (this.running && !this.currentPhase.has(node)) {
      this.nextPase.set(node, this.nextPase.get(node) || force);
    } else {
      this.currentPhase.set(node, this.currentPhase.get(node) || force);
    }
    if (this.timer) return;
    this.timer = Promise.resolve().then(this.loop);
  }

  delete(root) {
    const reg = new RegExp(`^${root.id}`);
    this.currentPhase.forEach((force, node) => {
      if (reg.test(node.id)) this.currentPhase.delete(node);
    });
    this.nextPase.forEach((force, node) => {
      if (reg.test(node.id)) this.nextPase.delete(node);
    });
  }

  loop = () => {
    if (this.nextPase.size) {
      this.currentPhase = this.nextPase;
      this.nextPase = new Map();
    }
    this.running = true;
    let queue = [];
    let err;
    this.currentPhase.forEach((force, node) => {
      const circleed = this.circleTimes.get(node) ?? 0;
      if (circleed > 50) {
        err = new Error(
          `<${node.tag.name ?? node.tag} key=${
            node.key ?? ""
          }> 该组件循环更新多次!!!`
        );
      }
      this.circleTimes.set(node, circleed + 1);
      const len = node.id.split(",").length;
      (queue[len] || (queue[len] = [])).push(() => {
        this.currentPhase.delete(node);
        node.diff(this.currentPhase.get(node));
      });
    });
    queue.forEach(fns => fns.forEach(fn => fn()));
    queue = [];
    if (err) throw err;
    if (this.nextPase.size) {
      return this.firstPaint ? this.loop() : setTimeout(this.loop, 0);
    }
    this.firstPaint = false;
    this.circleTimes = new WeakMap();
    this.running = false;
    this.timer = null;
  };
}

export default new Phase();
