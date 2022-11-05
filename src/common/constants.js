export const CONNECTOR_TYPES = {
  connector: 0,
  channel: 1 << 4,
  method: 2 << 4,
  maskCode: 0xf0
};

export const METHOD_TYPES = {
  post: 0,
  send: 1,
  receipt: 2,
  maskCode: 0xf
};

export const EVENT_TYPES = {
  connect: 0,
  destroy: 1,
  call: 2,
  initial: 3,
  patch: 4
};

export const DIFF_TYPES = {
  create: 1,
  update: 2,
  delete: 3,
  move: 4
};
