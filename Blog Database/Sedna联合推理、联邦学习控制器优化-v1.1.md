---
lang: [zh-CN, en-US]
date: "2025-01-01"
type: "Post"
slug: "sedna-ji-fl-controller-optimization-v1.1"
tags: [云原生, KubeEdge]
summary: "改了一些代码，但应该不会提到pr中。"
status: "Published"
---

# Sedna联合推理、联邦学习控制器优化-v1.1

在联邦学习实现修改自定义资源更改配置（`kubectl edit FederatedLearningJob **`）的时候，更新逻辑是`pod`没办法像修改联合推理自定义资源的deployment那样直接更新配置参数（可以看[这个issue](https://github.com/kubernetes/kubernetes/issues/24913)和[这个博客](https://blog.techiescamp.com/docs/pod-is-invalid-spec-forbidden/)），所以只能把`pod`全部删除了（因为没办法获取到单独的`pod`），利用新的配置再创建`pod`。在联合推理控制器的做法中，因为创建`deployment`时，名字是固定的，所以可以通过

```go
Deployment, err := c.deploymentsLister.Deployments(service.Namespace).Get(workerName)
```
 来获取特定的`deployment`直接修改参数并更新。但是目前生成`pod`取名后面有5个随机字符，没有办法做到通过名字来获取`pod` ，而且我还发现，在控制器中对pod的取名方法是没有起作用的（以下代码）

```go
"WORKER_NAME": "aggworker-" + utilrand.String(5)
```
这行代码其实没起作用，所以其实是kubernetes给`pod`自动起的名字。
然后寻找原因，原因是在`pkg/globalmanager/runtime/worker.go` 中的`injectWorkerParam` 函数中缺少对`pod.ObjectMeta.Name` 变量的赋值，我觉得应该这样赋值

```go
pod.ObjectMeta.Name = workerParam.Env["WORKER_NAME"]
```
然后就可以通过修改`"WORKER_NAME"` 来确定`pod`的名字，确定了`pod`的名字，再确定是修改了自定义资源具体哪个worker下的字段就可以删除单独的`pod`更新配置，创建出单独的pod了，而不用像之前一样全都删掉。

之后唐明老师提到，区别于推理任务，对于联邦学习这种训练任务，其实就相当于kubernetes中Job的概念。因为Job本身就是一次性的任务，所以不如直接禁止修改，如果想要修改参数直接删掉任务重新部署，我觉得说的也很有道理的。因此，再加上我认为pod本身就不支持更新，用这样的方式其实感觉是有点违背kubernetes意图的…所以其实下一个优化目标就是限制对资源的访问，这个还在搜集资料…

这个相比开源之夏的办法是一些微小的改动所以是v1.1，接下来因为和v1思路不同所以会是v2。所以这个也不会提pr。



