---
lang: [zh-CN, en-US]
date: "2025-04-11"
type: "Post"
slug: "Eino-learning-notes-1-ChatModel"
tags: [Eino, LLM]
summary: "Eino学习笔记，持续更新，也可能不更新。"
status: "Published"
---

# Eino学习笔记-1-ChatModel

ChatModel 是 Eino 框架中对对话大模型的抽象，它提供了统一的接口来与不同的大模型服务（如 OpenAI、Ollama 等）进行交互。
这个组件在以下场景中发挥重要作用：
- 自然语言对话
- 文本生成和补全
- 工具调用的参数生成
- 多模态交互（文本、图片、音频等）

# 组件定义

## 接口定义
> 代码位置：eino/components/model/interface.go

```go
type ChatModel interface {
    Generate(ctx context.Context, input []*schema.Message, opts ...Option) (*schema.Message, error)
    Stream(ctx context.Context, input []*schema.Message, opts ...Option) (*schema.StreamReader[*schema.Message], error)
    BindTools(tools []*schema.ToolInfo) error
}
```
Generate方法
- 功能：生成完整的模型响应
- 参数：
  - ctx：上下文对象，用于传递请求级别的信息，同时也用于传递Callback Manager
  - input：输入消息列表
  - opts：可选参数，用于配置模型行为
- 返回值：
  - `*schema.Message`：模型生成的响应消息
  - error：生成过程中的错误信息
Stream方法
- 功能：以流式方式生成模型响应
- 参数：与Generate方法相同
- 返回值：
  - `*schema.StreamReader[*schema.Message]`：模型响应的流式读取器
  - error：生成过程中的错误信息
BindTools方法
- 功能：为模型绑定可用的工具
- 参数：
  - tools：工具信息列表
- 返回值：
  - error：绑定过程中的错误信息

核心定位 该接口是对话模型的核心抽象层，支持两种调用模式：
- Generate ：同步生成完整响应（适合常规对话场景）
- Stream ：流式响应处理（适合长文本生成/实时交互）
架构特性

```go
type ChatModel interface {
    // 同步生成（典型AI对话模式）
    Generate(ctx context.Context, input []*schema.Message, opts ...Option) (*schema.Message, error)

    // 流式处理（适合逐段输出场景）
    Stream(ctx context.Context, input []*schema.Message, opts ...Option) (
        *schema.StreamReader[*schema.Message], error)

    // 工具绑定机制（支持功能扩展）
    BindTools(tools []*schema.ToolInfo) error
}

```
关键设计点 ：
- 多模型支持 ：通过接口抽象实现不同AI引擎（OpenAI/MAAS）的兼容
- 上下文感知 ：使用 context.Context 支持超时控制、链路追踪等
- 可扩展参数 ： ...Option 可变参数为不同实现提供配置扩展能力
- 工具热绑定 ： BindTools 实现运行时功能增强（推测支持Function Calling等特性）
工程实践 ：
   通过 `//go:generate` 指令自动生成 `ChatModelMock`模拟实现，说明：
- 接口优先设计原则
- 完善的单元测试支持
- 依赖注入能力（方便不同环境下的测试）
注意事项 ：
- 并发安全 ：注释明确提示 `BindTools` 与 `Generate` 存在非原子性操作，暗示需要同步控制
- 消息协议 ：依赖<schema.Message>定义的消息格式（需结合具体协议分析）
- 流式生命周期 ：` StreamReader` 需要配合Close操作确保资源释放

## Message结构体
> 代码位置：eino/schema/message.go

```go
type Message struct {   
    // Role 表示消息的角色（system/user/assistant/tool）
    Role RoleType
    // Content 是消息的文本内容
    Content string
    // MultiContent 是多模态内容，支持文本、图片、音频等
    MultiContent []ChatMessagePart
    // Name 是消息的发送者名称
    Name string
    // ToolCalls 是 assistant 消息中的工具调用信息
    ToolCalls []ToolCall
    // ToolCallID 是 tool 消息的工具调用 ID
    ToolCallID string
    // ResponseMeta 包含响应的元信息
    ResponseMeta *ResponseMeta
    // Extra 用于存储额外信息
    Extra map[string]any
}
```
Message结构体是模型交互的基本结构，支持：
- 多种角色：system（系统）、user（用户）、assistant（ai）、tool（工具）
- 多模态内容：文本、图片、音频、视频、文件
- 工具调用：支持模型调用外部工具和函数
- 元信息：包含响应原因、token使用统计等

## 公共Option
Model组件提供了一组公共Option用于配置模型行为：
> 代码位置：eino/components/model/option.go

```go
type Options struct {
    // Temperature 控制输出的随机性
    Temperature *float32
    // MaxTokens 控制生成的最大 token 数量
    MaxTokens *int
    // Model 指定使用的模型名称
    Model *string
    // TopP 控制输出的多样性
    TopP *float32
    // Stop 指定停止生成的条件
    Stop []string
}
```
可以通过以下方式设置Option：

```go
// 设置温度
WithTemperature(temperature float32) Option

// 设置最大 token 数
WithMaxTokens(maxTokens int) Option

// 设置模型名称
WithModel(name string) Option

// 设置 top_p 值
WithTopP(topP float32) Option

// 设置停止词
WithStop(stop []string) Option
```

# 使用方式

## 单独使用

```go
import (
    "context"
    "fmt"
    "io"

    "github.com/cloudwego/eino-ext/components/model/openai"
    "github.com/cloudwego/eino/components/model"
    "github.com/cloudwego/eino/schema"
)

// 初始化模型 (以openai为例)
cm, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
    // 配置参数
})

// 准备输入消息
messages := []*schema.Message{
    {
       Role:    schema.System,
       Content: "你是一个有帮助的助手。",
    },
    {
       Role:    schema.User,
       Content: "你好！",
    },
}

// 生成响应
response, err := cm.Generate(ctx, messages, model.WithTemperature(0.8))

// 响应处理
fmt.Print(response.Content)

// 流式生成
streamResult, err := cm.Stream(ctx, messages)

defer streamResult.Close()

for {
    chunk, err := streamResult.Recv()
    if err == io.EOF {
       break
    }
    if err != nil {
       // 错误处理
    }
    // 响应片段处理
    fmt.Print(chunk.Content)
}
```

## 在编排中使用

```go
import (
    "github.com/cloudwego/eino/schema"
    "github.com/cloudwego/eino/compose"
)

/*** 初始化ChatModel
* cm, err := xxx
*/

// 在 Chain 中使用
c := compose.NewChain[[]*schema.Message, *schema.Message]()
c.AppendChatModel(cm)


// 在 Graph 中使用
g := compose.NewGraph[[]*schema.Message, *schema.Message]()
g.AddChatModelNode("model_node", cm)
```

# Option和Callback使用

## Option使用示例

```go
import "github.com/cloudwego/eino/components/model"

// 使用 Option
response, err := cm.Generate(ctx, messages,
    model.WithTemperature(0.7),
    model.WithMaxTokens(2000),
    model.WithModel("gpt-4"),
)
```

## Callback使用示例

```go
import (
    "context"
    "fmt"

    "github.com/cloudwego/eino/callbacks"
    "github.com/cloudwego/eino/components/model"
    "github.com/cloudwego/eino/compose"
    "github.com/cloudwego/eino/schema"
    callbacksHelper "github.com/cloudwego/eino/utils/callbacks"
)

// 创建 callback handler
handler := &callbacksHelper.ModelCallbackHandler{
    OnStart: func(ctx context.Context, info *callbacks.RunInfo, input *model.CallbackInput) context.Context {
       fmt.Printf("开始生成，输入消息数量: %d\n", len(input.Messages))
       return ctx
    },
    OnEnd: func(ctx context.Context, info *callbacks.RunInfo, output *model.CallbackOutput) context.Context {
       fmt.Printf("生成完成，Token 使用情况: %+v\n", output.TokenUsage)
       return ctx
    },
    OnEndWithStreamOutput: func(ctx context.Context, info *callbacks.RunInfo, output *schema.StreamReader[*model.CallbackOutput]) context.Context {
       fmt.Println("开始接收流式输出")
       defer output.Close()
       return ctx
    },
}

// 使用 callback handler
helper := callbacksHelper.NewHandlerHelper().
    ChatModel(handler).
    Handler()

/*** compose a chain
* chain := NewChain
* chain.appendxxx().
*       appendxxx().
*       ...
*/

// 在运行时使用
runnable, err := chain.Compile()
if err != nil {
    return err
}
result, err := runnable.Invoke(ctx, messages, compose.WithCallbacks(helper))
```

# 已有实现
1. OpenAI ChatModel: 使用 OpenAI 的 GPT 系列模型 [ChatModel - OpenAI](https://www.cloudwego.io/zh/docs/eino/ecosystem_integration/chat_model/chat_model_openai)
2. Ollama ChatModel: 使用 Ollama 本地模型 [ChatModel - Ollama](https://www.cloudwego.io/zh/docs/eino/ecosystem_integration/chat_model/chat_model_ollama)
3. ARK ChatModel: 使用 ARK 平台的模型服务 [ChatModel - ARK](https://www.cloudwego.io/zh/docs/eino/ecosystem_integration/chat_model/chat_model_ark)

# 自行实现参考
实现自定义的 ChatModel 组件时，需要注意以下几点：
1. 注意要实现公共的 option
2. 注意实现 callback 机制
3. 在流式输出时记得完成输出后要 close writer

## Option机制
自定义 ChatModel 如果需要公共 Option 以外的 Option，可以利用组件抽象的工具函数实现自定义的 Option，例如：

```go
import (
    "time"

    "github.com/cloudwego/eino/components/model"
)

// 定义 Option 结构体
type MyChatModelOptions struct {
    Options    *model.Options
    RetryCount int
    Timeout    time.Duration
}

// 定义 Option 函数
func WithRetryCount(count int) model.Option {
    return model.WrapImplSpecificOptFn(func(o *MyChatModelOptions) {
       o.RetryCount = count
    })
}

func WithTimeout(timeout time.Duration) model.Option {
    return model.WrapImplSpecificOptFn(func(o *MyChatModelOptions) {
       o.Timeout = timeout
    })
}
```

## Callback处理
ChatModel 实现需要在适当的时机触发回调，以下结构由 ChatModel 组件定义：

```go
import (
    "github.com/cloudwego/eino/schema"
)

// 定义回调输入输出
type CallbackInput struct {
    Messages    []*schema.Message
    Model       string
    Temperature *float32
    MaxTokens   *int
    Extra       map[string]any
}

type CallbackOutput struct {
    Message    *schema.Message
    TokenUsage *schema.TokenUsage
    Extra      map[string]any
}
```

# 完整实现示例

```go
import (
    "context"
    "errors"
    "net/http"
    "time"

    "github.com/cloudwego/eino/callbacks"
    "github.com/cloudwego/eino/components/model"
    "github.com/cloudwego/eino/schema"
)

type MyChatModel struct {
    client     *http.Client
    apiKey     string
    baseURL    string
    model      string
    timeout    time.Duration
    retryCount int
}

type MyChatModelConfig struct {
    APIKey string
}

func NewMyChatModel(config *MyChatModelConfig) (*MyChatModel, error) {
    if config.APIKey == "" {
       return nil, errors.New("api key is required")
    }

    return &MyChatModel{
       client: &http.Client{},
       apiKey: config.APIKey,
    }, nil
}

func (m *MyChatModel) Generate(ctx context.Context, messages []*schema.Message, opts ...model.Option) (*schema.Message, error) {
    // 1. 处理选项
    options := &MyChatModelOptions{
       Options: &model.Options{
          Model: &m.model,
       },
       RetryCount: m.retryCount,
       Timeout:    m.timeout,
    }
    options.Options = model.GetCommonOptions(options.Options, opts...)
    options = model.GetImplSpecificOptions(options, opts...)

    // 2. 开始生成前的回调
    ctx = callbacks.OnStart(ctx, &model.CallbackInput{
       Messages: messages,
       Config: &model.Config{
          Model: *options.Options.Model,
       },
    })

    // 3. 执行生成逻辑
    response, err := m.doGenerate(ctx, messages, options)

    // 4. 处理错误和完成回调
    if err != nil {
       ctx = callbacks.OnError(ctx, err)
       return nil, err
    }

    ctx = callbacks.OnEnd(ctx, &model.CallbackOutput{
       Message: response,
    })

    return response, nil
}

func (m *MyChatModel) Stream(ctx context.Context, messages []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
    // 1. 处理选项
    options := &MyChatModelOptions{
       Options: &model.Options{
          Model: &m.model,
       },
       RetryCount: m.retryCount,
       Timeout:    m.timeout,
    }
    options.Options = model.GetCommonOptions(options.Options, opts...)
    options = model.GetImplSpecificOptions(options, opts...)

    // 2. 开始流式生成前的回调
    ctx = callbacks.OnStart(ctx, &model.CallbackInput{
       Messages: messages,
       Config: &model.Config{
          Model: *options.Options.Model,
       },
    })

    // 3. 创建流式响应
    // Pipe产生一个StreamReader和一个StreamWrite，向StreamWrite中写入可以从StreamReader中读到，二者并发安全。
    // 实现中异步向StreamWrite中写入生成内容，返回StreamReader作为返回值
    // ***StreamReader是一个数据流，仅可读一次，组件自行实现Callback时，既需要通过OnEndWithCallbackOutput向callback传递数据流，也需要向返回一个数据流，需要对数据流进行一次拷贝
    // 考虑到此种情形总是需要拷贝数据流，OnEndWithCallbackOutput函数会在内部拷贝并返回一个未被读取的流
    // 以下代码演示了一种流处理方式，处理方式不唯一
    sr, sw := schema.Pipe[*model.CallbackOutput](1)

    // 4. 启动异步生成
    go func() {
       defer sw.Close()

       // 流式写入
       m.doStream(ctx, messages, options, sw)
    }()

    // 5. 完成回调
    _, nsr := callbacks.OnEndWithStreamOutput(ctx, sr)

    return schema.StreamReaderWithConvert(nsr, func(t *model.CallbackOutput) (*schema.Message, error) {
       return t.Message, nil
    }), nil
}

func (m *MyChatModel) BindTools(tools []*schema.ToolInfo) error {
    // 实现工具绑定逻辑
    return nil
}

func (m *MyChatModel) doGenerate(ctx context.Context, messages []*schema.Message, opts *MyChatModelOptions) (*schema.Message, error) {
    // 实现生成逻辑
    return nil, nil
}

func (m *MyChatModel) doStream(ctx context.Context, messages []*schema.Message, opts *MyChatModelOptions, sr *schema.StreamWriter[*model.CallbackOutput]) {
    // 流式生成文本写入sr中
    return
}
```

# 参考资料



