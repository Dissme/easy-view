import { sameChildren, sameNode, sameObj } from "./helpers";

export function diff(curResults = [], nextResults) {
  const updateds = [];
  const moves = [];
  nextResults.forEach((nextNode, curIndex) => {
    const matchedIndex = curResults.findIndex(curNode =>
      diffNode(nextNode, curNode)
    );
    if (matchedIndex >= 0) {
      curResults[matchedIndex] = null;
      nextResults[curIndex] = null;
    }
  });

  return {
    updateds,
    moves
  };

  function diffNode(nextNode, curNode) {
    if (!sameNode(nextNode, curNode)) return false;
    const update = { id: curNode.id, curNode, diffrent: false };

    if (nextNode.id !== curNode.id) {
      moves.push({ from: curNode.index, to: nextNode.index });
      if (curNode._text) curNode.id = nextNode.id;
      curNode.index = nextNode.index;
    }

    if (!sameObj(nextNode.props, curNode.props)) {
      update.diffrent = true;
      Object.keys({ ...curNode.props, ...nextNode.props }).forEach(prop => {
        curNode.props[prop] = nextNode.props[prop];
      });
      update.props = curNode.props;
    }

    if (!sameObj(nextNode.eventHandlers, curNode.eventHandlers)) {
      let diffrent = false;
      curNode.offBindEventHandlers();
      Object.keys({
        ...curNode.eventHandlers,
        ...nextNode.eventHandlers
      }).forEach(eventName => {
        if (
          !curNode.eventHandlers[eventName] ||
          !nextNode.eventHandlers[eventName]
        ) {
          diffrent = true;
        }
        curNode.eventHandlers[eventName] = nextNode.eventHandlers[eventName];
      });
      update.diffrent = update.diffrent || diffrent;
      update.eventHandlers = curNode.eventHandlers;
      curNode.bindEventHandlers();
    }

    if (!sameChildren(nextNode.children, curNode.children)) {
      update.diffrent = true;
      curNode.children.splice(0, curNode.children.length, ...nextNode.children);
    }
    updateds.push(update);
    return true;
  }
}
