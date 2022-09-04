export class Hook {
  target = new EventTarget();

  on(type, listener) {
    this.target.addEventListener(type, listener);
  }

  off(type, listener) {
    this.target.removeEventListener(type, listener);
  }

  dispatch(type) {
    this.target.dispatchEvent(new Event(type));
  }
}
