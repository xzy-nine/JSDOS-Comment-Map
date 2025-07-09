# xzynine-jsdoc-comment-outline

xzynine-jsdoc-comment-outline 是一款为 JavaScript/TypeScript 文件提供 JSDoc 注释大纲的 VS Code 扩展。它可以自动解析文件中的 JSDoc 注释，生成结构化的树状大纲，帮助你通过jsdoc的注释快速浏览、定位和管理代码。

## 功能特性

- 自动解析 JS/TS 文件中的 JSDoc 注释，生成树状大纲视图
- 支持多级嵌套，彩色分层图标直观展示结构
- 点击大纲节点可自动跳转到对应代码行
- 选区变动时自动高亮并展开对应大纲节点
- 支持中英文注释内容

## 使用方法

1. 打开任意 JavaScript 或 TypeScript 文件
2. 在侧边栏找到“JSDoc 注释大纲”视图，自动展示当前文件的注释结构
3. 点击节点可跳转，右键可复制标题/描述

## 扩展设置

当前版本无需额外配置。

## 已知问题

- 仅支持 JS/TS 文件，暂不支持其他语言
- 依赖于 VS Code 的文档符号提供器，部分极端代码结构可能解析不完整

---

如有建议或问题，欢迎在 GitHub 提 Issue。
