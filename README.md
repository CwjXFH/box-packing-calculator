# 装箱计算器

计算一个大箱子最多能装下多少个**同尺寸**的小箱子，给出摆放方案、3D 示意图，以及实际重量、体积重和计费重量。

整个程序打包成**一个 HTML 文件**，双击就能用浏览器打开。不需要服务器、不需要联网、不需要安装，Windows 和 Mac 通用。

| 文档                                 | 读者                                       |
| ------------------------------------ | ------------------------------------------ |
| [docs/使用说明.md](docs/使用说明.md) | 业务同事：怎么填、结果怎么看、常见问题     |
| [docs/算法说明.md](docs/算法说明.md) | 开发维护者：算法原理、正确性依据、各项限制 |
| [docs/测试说明.md](docs/测试说明.md) | 开发维护者：测试分层、如何运行、发布前检查 |

## 快速开始

需要 Node.js 20 及以上（只有开发和打包时需要，使用者不需要）。

```bash
npm install
npm run dev        # 开发模式，浏览器打开终端里提示的地址
npm test           # 单元测试（约 20 秒）
npm run check      # TypeScript 类型检查
npm run build      # 打包，生成 dist/装箱计算器.html
npm run test:e2e   # 端到端测试，需先 build，并且本机装有 Chrome 或 Edge
```

## 发布

1. `npm run check && npm test && npm run build && npm run test:e2e`，全部通过。
2. 把 `dist/装箱计算器.html` 发给业务同事（微信、邮件、共享盘都可以）。只需要这一个文件。

## 功能

- 输入大箱子外径和壁厚（自动算出内径）、小箱子尺寸，以及各自的重量。尺寸精度 0.1cm，最大 1000cm。
- **混合方向**（默认）：小箱子可以朝不同方向摆放，求最多能装几个；标明结果是否已证明为最大值。
- **单一方向**：所有小箱子朝向相同，现场装箱更方便；结果是该约束下的精确最大值，并给出「缩小大箱子」的建议。
- 3D 示意图（同一朝向同一颜色）、各朝向数量统计、分区摆放明细。
- 实际总重量、体积重（按外径 ÷ 除数）、计费重量（取较大值）。

## 代码结构

```
client/
  index.html                         页面入口
  src/
    main.tsx, App.tsx                启动与错误兜底
    pages/Home.tsx                   主页面：表单、结果展示
    components/
      PackingVisualization3D.tsx     3D 示意图（Three.js，InstancedMesh）
      ErrorBoundary.tsx              出错时的兜底页面
      ui/                            基础组件（按钮、输入框、开关等）
    lib/
      packing.ts                     装箱算法（纯函数，不依赖界面）
      packing.worker.ts              在后台线程运行算法
      runPacking.ts                  调用后台线程；不可用时自动退回主线程
      form.ts                        输入解析与校验（cm → 整数毫米）
      *.test.ts                      单元测试
scripts/
  finalize-build.mjs                 打包后把文件重命名为「装箱计算器.html」
  e2e.mjs                            端到端测试
```

## 技术要点

- **React 19 + TypeScript + Tailwind CSS 4 + Three.js**，用 Vite 构建。
- **单文件打包**：通过 `vite-plugin-singlefile` 把 JS、CSS、图标全部内嵌进 HTML。不使用任何在线字体、图片或统计服务。
- **后台计算**：Web Worker 以内联方式打包。必须使用 `worker.format: "iife"`（传统 Worker）；ES 模块 Worker 在 `file://` 下会被 Chrome/Edge 拒绝。这一点由端到端测试保证。
- **整数毫米**：界面输入的 cm 一律换算成整数毫米再计算，避免 `0.1 + 0.2` 这类浮点误差导致少算。
