import GroupChannel from "../common/channel";
import { EVENT_TYPES } from "../common/constants";

export function render(node) {
  const channel = new GroupChannel();
  listen.channel = channel;

  node.id = ",0";
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
