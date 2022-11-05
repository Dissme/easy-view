const map = {};

export function inject(name) {
  return function fieldDec() {
    return function initializer(initialValue) {
      const Ctr = map[name];
      if (!Ctr) return initialValue;
      return new Ctr();
    };
  };
}

export function provide(name) {
  return function (T) {
    map[name] = T;
  };
}
