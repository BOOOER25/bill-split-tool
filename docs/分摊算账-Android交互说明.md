# 分摊算账 · Android 交互说明

依据用户提供的《js和客户端交互说明.md》。所有调用均沿用其报文和回调协议，不调用业务服务端接口。

## 本次需要接入

| action | 状态 | 用途 |
| --- | --- | --- |
| `getLocalBills` | **需新增** | 所有账本本地支出合并排序后，取最近 200 条 |
| `shareImg` | 参考文档已有，Android 2.7 添加 | 分享导出的图片、保存到相册 |
| `backIntercept` | 控制参数已有，Android 1.9 支持；返回通知待确认 | 确认原生通知协议后可用于弹窗返回 |

新接口的完整参数、字段和验收规则见[读取本地账单接口](分摊算账-读取本地账单接口.md)。Android 与 iOS 必须使用同一份业务约定。

## H5 调用入口

```js
window.callNative.evaluateJsToNative(JSON.stringify({
  action: 'getLocalBills',
  requestId: 'bill-1',
  data: { scope: 'all', limit: 200, type: 'expense' }
}));
```

不可传 JavaScript 对象，必须传 JSON 字符串。H5 页面已在 `<head>` 注册全局回调：

```js
window.onSuccessCallback(jsonString);
window.onFailCallback(jsonString);
window.evaluateNativeToJSUnCallback(jsonString);
```

客户端回传时须安全序列化参数，不直接拼接未经转义的账单名称到 JS 源码。成功和失败都保留原 `action`、`requestId`。

示例回调内容：

```json
{
  "action": "getLocalBills",
  "requestId": "bill-1",
  "data": {
    "items": []
  }
}
```

返回消费时，每条 `items[]` 都携带所属账本的 `bookId`、`bookName`；它们不放在 `data` 顶层。所有账本合计最多 200 条，不依赖当前打开的账本。

## 图片分享与保存

使用已有 `shareImg`，H5 内生成 PNG，无图片上传和图片 URL：

```js
window.callNative.evaluateJsToNative(JSON.stringify({
  action: 'shareImg',
  requestId: 'image-1',
  data: {
    platform: 0,
    base64: 'data:image/png;base64,...'
  }
}));
```

| platform | 操作 |
| --- | --- |
| 0 | 微信好友 |
| 1 | 微信朋友圈 |
| 2 | QQ 好友 |
| 3 | 保存到本地 |

```json
{
  "action": "shareImg",
  "requestId": "image-1",
  "data": { "code": 200, "msg": "分享完成" }
}
```

即使进入 `onSuccessCallback`，H5 仍检查 `data.code`：仅 200 代表成功。301 参数错误、302 空图片、400 正在处理、-1000004 保存权限被拒绝、-1000002 用户取消、-1000001 未安装目标 App。取消不提示成功。

分享等待最多 60 秒，处理中禁用重复按钮。超时后不自动重试，避免客户端仍在处理时重复分享；用户可在原生操作结束后主动再次点击。目标分享平台可能使用网络，这是用户主动分享行为，不是 H5 业务接口。

文字导出由 H5 复制到剪贴板；不使用 `share` 冒充本地图片或文字分享，已有 `share` 仅是网页链接分享。

## 返回与本地保存

Android 参考文档只列出 `backIntercept {intercept:true/false}` 控制参数，没有说明返回事件如何通知 H5。因此正式包默认 `androidBackIntercept: false`，保留客户端正常返回，避免开启后无法处理返回。

若需实现“原生返回先关弹窗”，两端约定客户端返回事件通过无需应答通道发送：

```json
{"action":"backIntercept","requestId":"0"}
```

客户端实现并验证该通知后，将配置改为 `androidBackIntercept: true`。此时弹窗打开时发送 `true`，H5 接收通知后关闭弹窗并发送 `false`。此通知协议属于本次接入约定，不能当成参考文档已支持的行为。

分摊快照、个人追加、收款、结清状态及历史记录写在此 H5 来源下的 `localStorage`，不写回客户端原账单。WebView 接入方须启用 DOM Storage，并保持同一正式 HTTPS 域名及持久 WebView 数据。

清除 WebView 数据、卸载 App、切换设备不会保留这些 H5 数据；此版本无云同步。账号切换不会自动隔离这个来源中的分摊记录，如产品需要按账号隔离，需另行约定本地命名空间，不能直接按“已支持”上线宣传。

## 联调入口

正式页 `/` 不包含模拟数据。电脑 `/demo/` 使用独立模拟桥接及存储，不能用于验证真实数据库、系统分享、相册权限或原生返回。原生联调须在 App 内打开正式页。

客户端需完成 `getLocalBills` 后才能读取真实账单；保留当前文档中的 action 名称不代表客户端已实现。
