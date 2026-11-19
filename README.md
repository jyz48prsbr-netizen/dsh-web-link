# dsh-web-link

在 DeepSeek Harness 左侧栏增加一个「DeepSeek 网页版」入口，点击后在主内容区直接内嵌原生 `chat.deepseek.com` 网页版——不跳出界面、不消耗 Harness 会话 token。

## 功能

- 侧栏一键打开原生 DeepSeek 网页版，主区内嵌显示。
- 通过 DSH 桌面壳的 `window.dshDesktop.browser` 桥创建 Electron `<webview>` 独立渲染进程。
- 加载失败或页面退出时，面板内显示错误与「重试」按钮，不影响整个应用。
- 使用固定隔离分区，切换面板或重载后通常保持登录，且不影响 DSH 本身与其它站点的会话。
- 只提供入口与内嵌容器，不处理对话数据，也不参与模型计费。

## 为什么用 webview 而不是 iframe

`chat.deepseek.com` 的响应头设置了 `Content-Security-Policy: frame-ancestors 'none'`，任何 iframe 内嵌都会白屏。Electron `<webview>` 不受该 CSP 限制，因此能在界面内正常显示。

## 安装

在 DSH 插件页通过本地目录安装，或通过插件市场索引安装本包。

> **仅桌面版可用**：`dsh web` 浏览器形态没有 guest 租约桥，入口会提示「当前环境不支持内嵌浏览器」。

详细配置与注意事项见 [docs/DETAIL.md](docs/DETAIL.md)。

## 许可

MIT
