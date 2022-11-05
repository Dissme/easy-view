import GroupChannel, { Channel } from "./channel";
import { Connector } from "./connector";
import { CONNECTOR_TYPES, EVENT_TYPES } from "./constants";

export function render(node) {
  const groupChannel = new GroupChannel();
  groupChannel.register(EVENT_TYPES.call, e => node.emit(e));

  node.channel = groupChannel;
  node.diff();

  return function listen(port) {
    const connector = Connector.getInstance(port);
    const channel = new Channel();

    connector.register(CONNECTOR_TYPES.connector, async ({ detail }) => {
      if (detail === EVENT_TYPES.connect) {
        channel.connect(port);
        await node.post();
        channel.postMessage(EVENT_TYPES.initial, node.getNodes());
      }
      if (detail === EVENT_TYPES.destroy) {
        channel.disconnect();
      }
    });

    return groupChannel.add(channel);
  };
}
