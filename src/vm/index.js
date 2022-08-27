import { VMChannel } from "./channel";

export function render(node) {
  const onMessage = data => {
    node.emit(data);
  };
  const channel = new VMChannel(onMessage);

  node.id = ",0";
  node.watch(channel.callOut);
  node.diff();

  return port => {
    const cid = channel.addPort(port);
    node.callInitail(cid);
  };
}
