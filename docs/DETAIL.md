# DeepSeek 网页版入口

在 DeepSeek Harness 左侧导航栏（与「插件」「定时任务」同一区域）增加一个入口，点击后在**主内容区直接内嵌**原生 DeepSeek 网页版 `chat.deepseek.com`，不跳出界面、不消耗 Harness 会话 token。

## 使用

点击左侧栏的「DeepSeek 网页版」入口，主区域会用 Electron `<webview>` 加载原生网页版。加载失败或页面退出时，面板内会显示错误与「重试」按钮，不会影响整个应用。

## 为什么用 webview 而不是 iframe

`chat.deepseek.com` 在响应头设置了 `Content-Security-Policy: frame-ancestors 'none'`，任何 iframe 都无法内嵌它（会白屏）。本插件通过 DSH 桌面壳提供的 guest 租约桥 `window.dshDesktop.browser` 创建 Electron `<webview>`（独立渲染进程），不受该 CSP 限制，因此能在界面内正常显示。

## 注意事项

- **仅桌面版可用**：`dsh web` 浏览器形态没有 guest 租约桥，入口会提示「当前环境不支持内嵌浏览器」。
- 登录态保存在 webview 的独立 guest 分区中；分区标识固定，切换面板或重载后通常能保持登录。
- 面板使用固定的隔离分区，不影响 DSH 本身与其它站点的会话。
- 本插件只提供入口与内嵌容器，不处理任何对话数据，也不参与模型计费。
