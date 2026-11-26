# 分摊算账 · iOS 交互说明

依据用户提供的 `index.md`（MMWebViewController，2026-08-31）。沿用现有 `WKScriptMessageHandler` 协议。所有分摊数据在本地，业务无需服务端接口。

## 本次需要接入

| action | 状态 | 用途 |
| --- | --- | --- |
| `getLocalBills` | **需新增** | 所有账本本地支出合并排序后，取最近 200 条 |
| `shareImg` | **需新增，当前参考文档未支持** | 原生分享图片及保存相册；参数向 Android 对齐 |
| `backIntercept` | 当前参考文档已有 | 弹窗返回拦截，收到返回通知后为一次性消费 |

现有 `share` 是网页链接分享，不可替代收据图片分享。发布包的 `config.js` 默认 `iosShareImg: false`；在 iOS 完成下面的图片协议并验证后再设为 `true`。未接入时页面提供预览图片及“长按预览图保存或发送”提示，不虚报分享或保存成功；长按菜单可用性需在实际 WKWebView 验证。

## H5 调用入口

```js
window.webkit.messageHandlers.evaluateJsToNative.postMessage(JSON.stringify({
  action: 'getLocalBills',
  requestId: 'bill-1',
  data: { scope: 'all', limit: 200, type: 'expense' }
}));
```

必须传 JSON 字符串，不能直接传对象。完整业务约定见[读取本地账单接口](分摊算账-读取本地账单接口.md)：无日期筛选、无分页，客户端从本地所有账本合并支出，统一排序后总共取最近 200 条，不依赖当前打开的账本。

客户端调用以下页面全局函数，参数也是 JSON 字符串：

```js
window.onSuccessCallback(jsonString);
window.onFailCallback(jsonString);
window.evaluateNativeToJSUnCallback(jsonString);
```

H5 已在 `<head>` 注册。回传时安全编码整个 JSON 字符串，避免名称中的引号、换行造成 JS 拼接错误。

```json
{
  "action": "getLocalBills",
  "requestId": "bill-1",
  "data": {
    "items": []
  }
}
```

返回消费时，每条 `items[]` 都携带所属账本的 `bookId`、`bookName`；它们不放在 `data` 顶层。

失败通过 `onFailCallback` 回传，原样保留 `action`、`requestId`，错误格式与 Android 相同。

当前 iOS 可能静默忽略未知 action。H5 等待 10 秒后提示未接入或未响应，不自动改用模拟数据、不调用服务端兜底。

## 拟新增图片协议：shareImg

```js
window.webkit.messageHandlers.evaluateJsToNative.postMessage(JSON.stringify({
  action: 'shareImg',
  requestId: 'image-1',
  data: {
    platform: 0,
    base64: 'data:image/png;base64,...'
  }
}));
```

`platform`：0 微信好友、1 朋友圈、2 QQ 好友、3 保存本地。客户端解码 H5 生成的 PNG，不上传图片。若目标分享渠道未实现，明确回调失败，不替换成网页分享。

成功：

```json
{
  "action": "shareImg",
  "requestId": "image-1",
  "data": { "code": 200, "msg": "分享完成" }
}
```

结果码向 Android 对齐：301 平台错误、302 图片为空或无效、400 正在处理中、-1000004 保存权限被拒绝、-1000002 用户取消、-1000001 未安装目标 App。按实际原生结果回调，不能在打开分享面板时就返回 200。H5 等待 60 秒，不自动重复调用。

实现完成并真机验证前保持 `iosShareImg: false`。相册权限说明、权限请求时机、微信/QQ SDK 及渠道配置由客户端处理。文字版使用 H5 复制文字，不新增服务端接口。

## 返回处理

H5 打开弹窗时发送：

```json
{"action":"backIntercept","requestId":"back-1","data":{"intercept":true}}
```

此调用不依赖成功回调。原生返回时通知：

```json
{"action":"backIntercept","requestId":"0"}
```

经 `evaluateNativeToJSUnCallback` 到 H5。iOS 此时已清除本次拦截；H5 关闭弹窗并发送 `intercept:false`，后续重新打开弹窗时重新开启。页面不等待 `close`/`goBack` 的离页回调确认关闭结果。

## 数据存储与联调

使用持久的 WKWebView 网站数据存储，保持正式 HTTPS 来源稳定。分摊快照、个人追加、收款记录、结清状态及历史分摊写到 H5 `localStorage`，不会回写原记账消费。

正式域名、电脑 localhost、手机局域网地址是不同来源，数据不会相互迁移。清除网站数据或卸载 App 后无法通过此工具恢复；不跨设备同步。账号隔离未在本次协议中实现，如需隔离必须另定本地命名空间。

原生真机打开正式页 `/` 验证 200 条读取、空账本、离线读取、重启持久化、返回拦截和原生图片操作。电脑 `/demo/` 仅预览交互，不能证明上述原生能力已接通。
