

## [0.2.10](https://github.com/Dissme/easy-view/compare/0.2.9...0.2.10) (2022-11-19)


### 🐛 Bug 修复

* 修复 channel 没有 transfer 的能力 ([6e110ca](https://github.com/Dissme/easy-view/commit/6e110caf72f14f523f96959bfce3c0f6d587a8d8))

## [0.2.9](https://github.com/Dissme/easy-view/compare/0.2.8...0.2.9) (2022-11-14)


### 🐛 Bug 修复

* 修复卸载事件没调用的bug，修复 channel 不共享连接逻辑的bug ([a504eb7](https://github.com/Dissme/easy-view/commit/a504eb762c35d759d96dba79cd3fa1499761f441))

## [0.2.8](https://github.com/Dissme/easy-view/compare/0.2.7...0.2.8) (2022-11-06)


### 🐛 Bug 修复

* **microcomponent:** 修复远程挂载的节点断开逻辑不执行的问题 ([881b197](https://github.com/Dissme/easy-view/commit/881b197e69ba363102108054dbb51551cfe708b6))

## [0.2.7](https://github.com/Dissme/easy-view/compare/0.2.6...0.2.7) (2022-11-05)


### 🐛 Bug 修复

* **dom:** 修复自定义组件没设属性的bug ([c1db9f8](https://github.com/Dissme/easy-view/commit/c1db9f8ff0ea814163d714f60d980ae6ce48c6f3))

## [0.2.6](https://github.com/Dissme/easy-view/compare/0.2.5...0.2.6) (2022-11-05)


### ♻ 重构

* 重构了channel部分，分层更清晰；重构了microComponent，去掉了proxy的逻辑，用shadowdom直接挂载远程组件。 ([f205be5](https://github.com/Dissme/easy-view/commit/f205be52aeb1ac6c5f25e9b465d9b10836198b4c))

## [0.2.5](https://github.com/Dissme/easy-view/compare/0.2.4...0.2.5) (2022-10-14)


### 🐛 Bug 修复

* **node:** 修复递归触发事件时不解绑的bug，事件触发后默认调用一次update ([aef9ca4](https://github.com/Dissme/easy-view/commit/aef9ca4a17a89f73164515d1d25b3ae0c5af0136))

## [0.2.4](https://github.com/Dissme/easy-view/compare/0.2.3...0.2.4) (2022-10-12)


### 🐛 Bug 修复

* **dom:** 修复一个patch过程中会删除失败的bug ([64be439](https://github.com/Dissme/easy-view/commit/64be4394d75009d3ad453bb18342f623bc455ef4))

## [0.2.3](https://github.com/Dissme/easy-view/compare/0.2.2...0.2.3) (2022-10-07)


### ♻ 重构

* 重构了channel提供了methodChannel；删掉了一些用不到的功能；修改了组件API； ([f64e168](https://github.com/Dissme/easy-view/commit/f64e16832508e14808ec274460b782f18e808b9d))

## [0.2.2](https://github.com/Dissme/easy-view/compare/0.2.1...0.2.2) (2022-09-24)


### 🐛 Bug 修复

* 修复组件会覆盖子节点class的bug，修复重构时遗漏的method引用导致的undefined的bug ([6f9b6d5](https://github.com/Dissme/easy-view/commit/6f9b6d5a6ebfa8229846d10b4cea31e2db9b7fca))

## [0.2.1](https://github.com/Dissme/easy-view/compare/0.2.0...0.2.1) (2022-09-15)


### ♻ 重构

* **jsx-runtime:** 重构了事件流，调整了API。 ([7169cd7](https://github.com/Dissme/easy-view/commit/7169cd767962fa62d1382ee4ee51d44c0f538999))

## [0.2.0](https://github.com/Dissme/easy-view/compare/0.1.1...0.2.0) (2022-09-04)


### ✨ 特性

* 新增 Channel 类，统一通信协议；新增 MicroComponent 组件，提供微前端能力。 ([3429caf](https://github.com/Dissme/easy-view/commit/3429caf9ed79b6b9e2c6077c58da6d584a426675))

## [0.1.1](https://github.com/Dissme/easy-view/compare/0.1.0...0.1.1) (2022-08-29)


### 📦 杂项

* **node:** 修改了组件返回值的语法 现在组件的返回值包裹在闭包里了 ([15bd6cb](https://github.com/Dissme/easy-view/commit/15bd6cb42a2aa626416d508578fff4e6bdaab9e6))

## 0.1.0 (2022-08-27)


### ✨ 特性

* 初始化 ([5d3702f](https://github.com/Dissme/easy-view/commit/5d3702f401259ed0dfd2176d8fa919bf988cf40e))