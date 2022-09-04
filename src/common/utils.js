export class MultiKeyMap {
  keys = [];
  values = [];

  set(...keys) {
    keys = keys.sort();
    return value => {
      const index = this.#indexOf(keys);
      this.keys[index] = keys;
      this.values[index] = value;
    };
  }

  get(...keys) {
    keys = keys.sort();
    return this.values[this.#indexOf(keys)];
  }

  delete(...keys) {
    const index = this.#indexOf(keys.sort());
    if (index < this.keys.length) {
      this.keys.splice(index, 1);
      this.values.splice(index, 1);
    }
  }

  #indexOf(keys) {
    for (let index = 0; index < this.keys.length; index++) {
      const multiKey = this.keys[index];
      let len = multiKey.length;
      if (len !== keys.length) continue;
      let isFound = true;
      while (len--) {
        if (keys[len] === multiKey[len]) continue;
        isFound = false;
        break;
      }
      if (isFound) return index;
    }
    return this.keys.length;
  }
}
