# Chat status

## Chat record

在 `ChatRecordContext` 中提供。

其中状态有三个：
- loading
- running
- finish

| 状态 | 作用 |
| --- | --- |
| `loading` | 加载中，此时 AI 聊天的头像右侧展示 loading 的效果 |
| `running` | 运行中 |
| `finish` |  |


这些状态变化封装在 `useChatGenerate` 中。

## isChatting

最后一条记录存在，且不为 finish，则视为聊天中。

在 `ChatBoxContext` 中提供。


## 流程

```mermaid
flowchart TD
A[开始] --> B[sendPrompt]
B --> C[参数校验]
C -- 非法 --> D[toast 报错]
C -- 合法 --> E[生成Human聊天对话:finished]
E --> F[生成 AI 聊天对话:loading]
F --> G[使用历史对话+上述对话，构成新纪录]
G --> H[更新 ChatBoxData]
H --> I[更新侧边栏的Title及状态]
I --> J[回写聊天记录]
J --> K[情况输入框的值] 

```


