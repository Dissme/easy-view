# easy-view

> 一个简单的MVP框架 UI和逻辑分离 支持运行在worker中 目前还不稳定

## 使用说明
```bash
npm i @easythings/easy-view
```

main.jsx
```jsx
import { mount, mountFromPort } from "@easythings/easy-view";

const worker = new Worker(new URL("./worker.jsx", import.meta.url));
const sharedWorker = new SharedWorker(
  new URL("./sharedWorker.jsx", import.meta.url)
);

function Main(props, children, eventHandlers, update) {
  return "Hello World";
}

const container1 = document.createElement("div");
const container2 = document.createElement("div");
const container3 = document.createElement("div");
document.body.append(container1, container2, container3);

mount(<Main />, container1); // 主线程用法

mountFromPort(worker, container2); // worker用法

mountFromPort(sharedWorker.port, container3); // sharedWorker用法
```

worker.jsx/sharedWorker.jsx
```jsx
import { render } from "@easythings/easy-view";
import { defineRender } from "@easythings/easy-view/jsx-runtime";

const listen = render(<WorkerComponent hello="world" />);

init();

function init() {
  const platform = self.constructor.name;
  const handler = {
    ["SharedWorkerGlobalScope"]() {
      self.onconnect = ({ ports }) => {
        ports.forEach(port => listen(port));
      };
    },
    ["DedicatedWorkerGlobalScope"]() {
      listen(self);
    }
  };
  handler[platform]?.();
}

function WorkerComponent(props, children, eventHandlers, update) {
  let i = 0;

  const onClick = (e, next) => {
    i++;
    console.log('事件从上向下')
    next();
    console.log('再从下向上')
  };
  const onClick2 = (e, next) => {
    console.log("可以用next(false)阻止向下");
    next(false);
    console.log(e, "但是从下往上没办法阻止");
  };
  const onClick3 = (e, next) => {
    console.log("123321");
  };
  // 如果不需要变量可以直接返回不用defineRender，后面我会弄个babel插件自动给代码加，就不用手动写了
  return defineRender(() => (
    <div on-click={onClick}>
      <div on-click={onClick2}>
        <div on-click={onClick3}>{i}</div>
      </div>
    </div>
  ));
}
```
jsx插件配置 可以参考[这个文件](./.babelrc)