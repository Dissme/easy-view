import GroupChannel from "./channel";
import { EVENT_TYPES } from "./constants";

export function render(node) {
  const channel = new GroupChannel();
  listen.channel = channel;

  node.channel = channel;
  node.diff();

  return listen;

  function listen(port) {
    const cid = channel.connect(port);
    channel.register(EVENT_TYPES.connect, () => node.callInital(cid), cid);
    channel.register(
      EVENT_TYPES.call,
      body => {
        body.cid = cid;
        node.emit(body);
      },
      cid
    );
    return cid;
  }
}
