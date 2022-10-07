export const EVENT_TYPES = {
  connect: 1, // 连接
  patch: 2, // 更新dom
  send: 3, // 需要回执的消息
  receipt: 4, // 消息回执
  call: 5, // 调用函数
  userCall: 6, // 用户调用函数
  destroy: 7 // 用户调用函数
};

export const DIFF_TYPES = {
  create: 1,
  update: 2,
  delete: 3,
  move: 4,
  connect: 5
};
