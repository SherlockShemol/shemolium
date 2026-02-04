---
lang: [zh-CN, en-US]
date: "2024-12-31"
type: "Post"
slug: "sedna-ji-fl-controller-optimization-v1"
tags: [云原生, KubeEdge]
summary: "一直想等到控制器部分完全完善了再整理出来，但是发现后面的完善方法和初次尝试的思路不一样了，所以决定分版本记录下来完善的方法。"
status: "Published"
---

# Sedna联合推理、联邦学习控制器优化-v1


# KubeEdge-Sedna
代码仓库：[https://github.com/kubeedge/sedna](https://github.com/kubeedge/sedna)
相关PR：
- [initial proposal](https://github.com/kubeedge/sedna/pull/437)
- [updated proposal](https://github.com/kubeedge/sedna/pull/438)
- [JointInferenceService controller enhancement](https://github.com/kubeedge/sedna/pull/445)
- [FederatedLearning controller enhancement](https://github.com/kubeedge/sedna/pull/446)
一直想等到控制器部分完全完善了再整理出来，但是发现后面的完善方法和初次尝试的思路不一样了，所以决定分版本记录下来完善的方法，v1大部分是开源之夏的内容。和proposal会有所不同，随着对kubernetes和kubeedge以及sedna的了解，希望自己能更深入进去。

# 优化需求
- 联合推理和联邦学习没有办法正常实现级联删除，`kubectl delete JointInferenceService/FederatedLearningJob **` 时子资源并不会随之被级联删除。
-  在`kubectl edit FederatedLearningJob/JointInferenceService **` 更新自定义资源配置时，其管理的子资源pod并不会随之更新。
- 希望实现当手动删除或者误操作删除pod时，pod能够被重新创建。

# 级联删除

## kubernetes中的级联删除
kubernetes 中的 Owner Reference 向控制面提供对象间的关联信息。kubernetes 通过 Owner Reference（属主引用）为控制面以及其他 API 客户端在删除某对象时提供一个清理关联资源的能力。在大多数情况下，kubernetes 自动管理 Owner Reference。垃圾收集器可以实现级联删除的功能
Kubernetes 的逻辑是删掉了一个资源时，如果其他资源的 Metadata 中的 ownerReference 中引用该资源，那么这些资源会被级联删除，这个行为是可以配置的，并且默认为 true。
每个资源的 metadata 中都会有 ownerReferences 字段，它是一个数组，用来表示该资源的 owner 有哪些。每当 owner 资源被删除，就会从这个数组中移除。当所有的 owner 都被删除后，GC 就会回收该资源。

其实只要知道这个就能顺利解决存在的问题，kubernetes自动控制管理级联删除，只要设置了正确的owner reference的值，就可以正常级联删除。那既然没有正常级联删除，问题就在于没能正常设置owner reference。然后在寻找创建任务和创建pod逻辑的代码就行。

## 联合推理和联邦学习的owner reference关系
JointInferenceService联合推理

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868898507.png)
FederatedLearningJob联邦学习

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868899532.png)

## 联合推理控制器owner reference设置过程
以联合推理控制器为例，分析 Ownerreference 设置过程。

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868900697.png)
发现整个owner reference的定义过程是没有问题的，那么存在问题的其实就是定义的变量。
在`pkg/globalmanager/controllers/jointinference/jointinferenceservice.go`中，首先定义了 controller name 和 CR 的 kind name。我们传入 Ownerreference 的值应该是 kind name 而不是控制器的名字。

```go
    // Name is this controller name
    Name = "JointInference"

    // KindName is the kind name of CR this controller controls
    KindName = "JointInferenceService"

```
在这里对 CR 的 kind name 进行定义，需要注意的是，原先的代码中传入的是 Name（JointInference），而实际应该传入 Kind Name（JointInferenceService）

```go
// Kind contains the schema.GroupVersionKind for this controller type.
var Kind = sednav1.SchemeGroupVersion.WithKind(KindName)
```
由 run 函数负责启动控制器，首先定义worker的数量，然后根据worker数量设置工作线程，不断从工作队列中获取任务并进行处理

```go
for i := 0; i < workers; i++ { go wait.Until(c.worker, time.Second, stopCh) }

```
在`run`函数的这段代码中，`wait.Until`函数启动了一个goroutine，不断调用`c.worker`函数，每次调用之间间隔一秒钟，直到`stopCh`信号关闭。

```go
// worker runs a worker thread that just dequeues items, processes them, and marks them done.
// It enforces that the sync is never invoked concurrently with the same key.
func (c *Controller) worker() {
    for c.processNextWorkItem() {
    }
}
```
`worker`函数调用`processNextWorkItem()`函数，由该函数从队列中获取任务并处理，调用`sync`函数执行具体的同步方法，直到队列被关闭。

```go
ns, name, err := cache.SplitMetaNamespaceKey(key)
if err != nil {
    return false, err
}
if len(ns) == 0 || len(name) == 0 {
    return false, fmt.Errorf("invalid jointinference service key %q: either namespace or name is missing", key)
}
```
在`sync`函数中，由`cache.SplitMetaNamespaceKey`函数解析key获取namespace和name

```go
sharedService, err := c.serviceLister.JointInferenceServices(ns).Get(name)
if err != nil {
    if errors.IsNotFound(err) {
        klog.V(4).Infof("JointInferenceService has been deleted: %v", key)
        return true, nil
    }
    return false, err
}
service := *sharedService
```
从lister中获取JointInferenceService对象

```go
service.SetGroupVersionKind(Kind)
```
设置GroupVersionKind

```go
selector, _ := runtime.GenerateSelector(&service)
pods, err := c.podStore.Pods(service.Namespace).List(selector)
if err != nil {
    return false, err
}
klog.V(4).Infof("list jointinference service %v/%v, %v pods: %v", service.Namespace, service.Name, len(pods), pods)
```
生成选择器并获取关联的pods。
当没有失败worker时，如果关联pods的数量为0，即调用`createWorkers`函数创建pod

```go
else {
        if len(pods) == 0 {
            active, manageServiceErr = c.createWorkers(&service)
        }
```
在`createWorkers`函数中调用`createCloudWorker`和`createEdgeWorker`来创建云边端工作pod
在两个函数中，`runtime.CreatePodWithTemplate`负责创建pod，其中的`k8scontroller.GetPodFromTemplate`设置Ownerreference，起作用的是以下代码

```go
    if controllerRef != nil {
        pod.OwnerReferences = append(pod.OwnerReferences, *controllerRef)
    }
```

# Pod重建
Pod 出现故障自动重建是由重启策略决定的（RestartPolicy）。
在 JointInferenceService 中，未设置 RestartPolicy，所以默认是 always 。在联合推理任务进行的过程中，当出现程序问题时，比如 EdgeMesh 未正确配置，导致边缘端无法访问云端5000端口进行云端的较大模型的推理，此时边缘端 pod 就会不断重启。在 FederatedLearningJob 中，设置 RestartPolicy 为 OnFailure。

要实现删除pod能够自动创建pod，需要先了解kubernetes的informer机制。

## k8s的informer机制
Kubernetes 使用 Informer 代替 Controller 去访问 API Server，Controller 的所有操作都和 Informer 进行交互，而 Informer 并不会每次都去访问 API Server。Informer 使用 ListAndWatch 的机制，在Informer首次启动时，会调用LIST API获取所有最新版本的资源对象，然后再通过WATCH API来监听这些对象的变化，并将事件信息维护在一个只读的缓存队列中提升查询的效率，同时降低API Server的负载。

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868901909.png)
根据流程图来解释Informer中几个组件的作用：
- Controller：Informer的实施载体，可以创建reflector及控制processLoop。processLoop将DeltaFIFO队列中的数据pop出，首先调用Indexer进行缓存并建立索引，然后分发给processor进行处理。
- Reflector：Informer并没有直接访问k8s-api-server，而是通过一个叫Reflector的对象进行api-server的访问。Reflector通过ListAndWatch监控指定的 kubernetes 资源，当资源发生变化的时候，例如发生了 Added 资源添加等事件，会将其资源对象存放在本地缓存 DeltaFIFO 中。
- DeltaFIFO：是一个先进先出的缓存队列，用来存储 Watch API 返回的各种事件，如Added、Updated、Deleted。
- LocalStore：就是 informer 的 cache，这里面缓存的是 apiserver 中的对象(其中有一部分可能还在DeltaFIFO 中)，此时使用者再查询对象的时候就直接从 cache 中查找，减少了 apiserver 的压力，LocalStore 只会被 Lister 的 List/Get 方法访问。
- WorkQueue：DeltaIFIFO 收到时间后会先将时间存储在自己的数据结构中，然后直接操作 Store 中存储的数据，更新完 store 后 DeltaIFIFO 会将该事件 pop 到 WorkQueue 中，Controller 收到 WorkQueue 中的事件会根据对应的类型触发对应的回调函数。

### informer的工作流程
Informer 首先会 list/watch apiserver，Informer 所使用的 Reflector 包负责与 apiserver 建立连接，Reflector 使用 ListAndWatch 的方法，会先从 apiserver 中 list 该资源的所有实例，list 会拿到该对象最新的 resourceVersion，然后使用 watch 方法监听该 resourceVersion 之后的所有变化，若中途出现异常，reflector 则会从断开的 resourceVersion 处重现尝试监听所有变化，一旦该对象的实例有创建、删除、更新动作，Reflector 都会收到”事件通知”，这时，该事件及它对应的 API 对象这个组合，被称为增量（Delta），它会被放进 DeltaFIFO 中。
- Informer 会不断地从这个 DeltaFIFO 中读取增量，每拿出一个对象，Informer 就会判断这个增量的时间类型，然后创建或更新本地的缓存，也就是 store。
- 如果事件类型是 Added（添加对象），那么 Informer 会通过 Indexer 的库把这个增量里的 API 对象保存到本地的缓存中，并为它创建索引，若为删除操作，则在本地缓存中删除该对象。
- DeltaFIFO 再 pop 这个事件到 controller 中，controller 会调用事先注册的 ResourceEventHandler 回调函数进行处理。
- 在 ResourceEventHandler 回调函数中，其实只是做了简单的过滤，然后将关心变更的 Object 放到 workqueue 里面。
- Controller 从 workqueue 里面取出 Object，启动一个 worker 来执行自己的业务逻辑，业务逻辑通常是计算目前集群的状态和用户希望达到的状态有多大的区别，然后让 apiserver 将状态演化到用户希望达到的状态，比如为 deployment 创建新的 pods，或者是扩容/缩容 deployment。
- 在worker中就可以使用 lister 来获取 resource，而不用频繁的访问 apiserver，因为 apiserver 中 resource 的变更都会反映到本地的 cache 中。
Informer 中的 ResourceEventHandler 函数有三种：

```go
// ResourceEventHandlerFuncs is an adaptor to let you easily specify as many or
// as few of the notification functions as you want while still implementing
// ResourceEventHandler.
type ResourceEventHandlerFuncs struct {
    AddFunc    func(obj interface{})
    UpdateFunc func(oldObj, newObj interface{})
    DeleteFunc func(obj interface{})
}
```
这三种函数的处理逻辑是用户自定义的，在初始化 controller 时注册完 ResourceEventHandler 后，一旦该对象的实例有创建、删除、更新三中操作后就会触发对应的 ResourceEventHandler。

## 联合推理和联邦学习控制器informer流程

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868902914.png)
以`jointinferenceservice.go`为例，`New()`函数创建一个新的`JointInferenceService`控制器，来使相关的pod与对应的`JointInferenceService`对象保持同步。在`New()`函数中，对`informer`进行初始化。

```go
podInformer := cc.KubeInformerFactory.Core().V1().Pods()

serviceInformer := cc.SednaInformerFactory.Sedna().V1alpha1().JointInferenceServices()
```
service informer使用自定义的handler:

```go
    serviceInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc: func(obj interface{}) {
            jc.enqueueController(obj, true)
            jc.syncToEdge(watch.Added, obj)
        },
        UpdateFunc: func(old, cur interface{}) {
            jc.enqueueController(cur, true)
            jc.syncToEdge(watch.Added, cur)
        },

        DeleteFunc: func(obj interface{}) {
            jc.enqueueController(obj, true)
            jc.syncToEdge(watch.Deleted, obj)
        },
    })
```
pod informer使用自定义handler:

```go
    podInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc:    jc.addPod,
        UpdateFunc: jc.updatePod,
        DeleteFunc: jc.deletePod,
    })
```
这里的`EventHandler`（`addPod`、`updatePod`、`deletePod`），其实只是将相关的对象加入队列中，并没有做其它处理。
`podInformer.Lister()` 创建`Lister()`获取Pod资源，`podInformer.Informer().HasSynced`检查Informer的缓存是否已经同步。

```go
    jc.serviceLister = serviceInformer.Lister()
    jc.serviceStoreSynced = serviceInformer.Informer().HasSynced
    //...
    jc.podStore = podInformer.Lister()
    jc.podStoreSynced = podInformer.Informer().HasSynced
```
从api server同步资源的过程，`jointinferenceservice`控制器是在`Run()`函数中进行的，`Run()`函数开启负责watch和sync服务的main goroutine。

```go
    if !cache.WaitForNamedCacheSync(Name, stopCh, c.podStoreSynced, c.serviceStoreSynced) {
        klog.Errorf("failed to wait for %s caches to sync", Name)
        return

    }
```
启动Informer后，等待本地cache sync完成后，启动workers。当收到变更事件后，从事件中获取变更的Object，生成object key（namespace/name形式），将key放入workerqueue中。
由`worker()`函数调用`c.processNextWorkItem()`函数。

```go
func (c *Controller) worker() {
    for c.processNextWorkItem() {
    }
}
```
`processNextWorkItem`函数从workerqueue中获取key，调用`sync()`，在`sync()`函数中通过lister从本地缓存中获取真正的object对象，执行相关的同步操作。

## 联邦学习pod重建方案设计

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868904025.png)
监听删除事件，当Informer监听到`OwnerReference`为`FederatedLearning`的删除事件，启动DeletePod函数，由DeletePod函数重建pod，重新创建后的Pod会和原来的Pod几乎一样，保留其配置和规范，但资源版本和UID等标识会被重置，以便重新生成。

### 代码逻辑
- **重建前检查**
  - 检查该pod是否被`FederatedLearningJob`所拥有。
  - 检查该Pod是否已经被重新创建过： 使用 `c.recreatedPods.Load(pod.Name)` 来检查这个Pod是否已经被重新创建过。如果已经重新创建，则不再重复创建。

```go
    // first check if the pod is owned by a FederatedLearningJob
    controllerRef := metav1.GetControllerOf(pod)
    if controllerRef == nil || controllerRef.Kind != Kind.Kind {
        return
    }
```
- **重新创建Pod**
  - 使用 `pod.DeepCopy()` 创建一个Pod的深拷贝。
  - 重置一些唯一标识（如 `ResourceVersion`、`UID`）和状态字段。
  - 通过 `c.kubeClient.CoreV1().Pods(pod.Namespace).Create` 方法调用 Kubernetes API 创建新的Pod。
  - 如果创建成功，记录日志，标记该Pod已被重新创建。

```go
    // Create a deep copy of the old pod
    newPod := pod.DeepCopy()
    // Reset the resource version and UID as they are unique to each object
    newPod.ResourceVersion = ""
    newPod.UID = ""
    // Clear the status
    newPod.Status = v1.PodStatus{}
    // Remove the deletion timestamp
    newPod.DeletionTimestamp = nil
    // Remove the deletion grace period seconds
    newPod.DeletionGracePeriodSeconds = nil
    _, err := c.kubeClient.CoreV1().Pods(pod.Namespace).Create(context.TODO(), newPod, metav1.CreateOptions{})
    if err != nil {
        return
    }
```
- **标记已重建并设置定时器清理记录**：
  - 使用 `c.recreatedPods.Store(pod.Name, true)` 标记这个Pod已经被重新创建。
  - 设置一个定时器，在5秒后清除这个标记（`c.recreatedPods.Delete(pod.Name)`），这样之后如果Pod再次被删除，可以重新触发重建逻辑。

```go
    // mark the pod as recreated
    c.recreatedPods.Store(newPod.Name, true)
    // set a timer to delete the record from the map after a while
    go func() {
        time.Sleep(5 * time.Second)
        c.recreatedPods.Delete(pod.Name)
    }()
```
我们在Controller的数据结构中增加`sync.Map`类型的`recreatedPods`，用来避免一个删除事件中pod被重复创建。当手动删除pod并且pod被成功创建后，pod的名称被加入到recreatedPods中，当同一个删除事件中deletePod再次被调用时，因为pod名称已经存在于recreatedPods中，因此手动删除的pod不会被重复删除和重复创建。同时设置定时器，5s后清除标记，便于之后如果pod再次被手动删除，可以重新触发重建逻辑。

```go
type Controller struct{
	//...
	preventRecreation bool
	//...
}
```

## 联合推理pod重建方案设计

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868905123.png)
推理任务本身是无状态负载，因此可以借助k8s的原生组件`deployment`实现pod自愈。需要构建完整的监控和处理资源变化的过程。
- 从informer工厂中获取`deployment informer`资源。
- 在informer中注册对事件的处理函数（`addDeployment`、`updateDeployment`、`deleteDeployment`）
- 启动informer并且和k8s api同步数据。
- 在开始处理事件前，需要等待本地缓存与API Server同步。
- 当集群中 `Deployment` 资源发生变化时，`Informer` 会触发相应的事件处理函数。

# 联邦学习修改CRD更新pod
联邦学习控制器修改CRD更新pod流程图：

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868906300.png)
监听更新事件，当Informer监听到关于`FederatedLearningJob`的更新事件，如果CRD有修改，删除原先的pod，并且根据CRD的新参数创建pod。

## 代码逻辑
启动`updateJob`函数，`updateJob`函数首先进行是否需要更新的判断。
- 如果`old`和`cur`没有办法转换成`sednav1.FederatedLearningJob`的对象，直接返回。
- 如果`oldJob`和`curJob`的`ResourceVersion`相同则表示没有变化，直接返回，不需要处理更新。
- 设置 `preventRecreation` 标志为 true，防止在更新期间重新创建 Pod。
接下来进行`oldJob`和`curJob`的参数比较。
- 比较`old.Generation`和`cur.Generation`字段。CRD都有一个Spec字段Generation。该字段是自动生成的，是每次修改/创建crd对象，都会修改，创建时为1，后面每次修改都会加1。只有当 spec 修改时，才会触发 Generation+1，而 status 的修改不会触发。因此可以用该字段，判断是 spec 修改还是 status 修改。如果不相等，则表示`FederatedLearningJob`的参数发生了变化。
- 然后遍历获取的Pod列表，删除每个 Pod。
- 使用更新后的`curJob.Spec`来重新创造`AggWorker`和`TrainWorker`。
- 将`preventRecreation`标志重置为 `false`不影响后续`pod`自愈。

# 联合推理修改CRD更新pod
联合推理控制器修改CRD更新pod流程图：

![](../_assets/Sedna联合推理、联邦学习控制器优化-v1_1770868907409.png)
监听更新事件，当Informer监听到关于`JointInferenceService`的更新事件，如果CRD有修改，就删除原先的pod，并且根据CRD的新参数创建pod。

## 代码逻辑
联合推理在修改CRD更新pod的逻辑上，和联邦学习基本一致。
启动`updateService`函数，比较`old.Generation`和`cur.Generation`字段。如果不相等，则表示`JointInferenceService`的参数发生了变化。
- 然后遍历获取的 Pod 列表，删除每个 Pod。
- 使用更新后的`curService.Spec`来重新创造`cloudWorker`和`edgeWorker`。

# 测试

## 联邦学习单元测试
采用单元测试而非e2e测试，着重测试两个修改后的函数`deletePod()`和`updateJob()`函数。

### `Test_deletePod()`

### 删除现有pod并重建
- 使用`fake.NewSimpleClientset()`创建了一个模拟的k8s客户端。
- 通过`fakeclient`创建一个测试用的pod。
- 创建一个控制器，把`fakeclient`注册进去。
- 把测试用pod传入`controller.deletePod()`函数中，使用`fakeClient.CoreV1().Pods("default").Get(context.TODO(), "test-pod", metav1.GetOptions{})`检查pod是否被重新创建，如果未被重新创建，则测试失败。

### 删除不存在pod
- 创建模拟客户端。
- 创建控制器。
- 调用`controller.deletePod()`删除不存在pod。
- 确认是否会有错误发生。

### `Test_updateJob()`
- mock pod list过程。
- 创建模拟客户端。
- 创建数据集，模型以及相关job和pod资源。
- 初始化控制器，传入假客户端，测试作业和mock pod list，以及事件广播器等必要的依赖项。
- 定义新job，并对其中部分参数进行更新（将`TrainingWorker`中`batch_size`从`32`改为`16`）.
- 调用`updateJob`函数，将旧job更新为新job，模拟实际环境中作业更新过程。
- 验证更新结果，如果更新后参数符合预期，测试通过。

## 联合推理单元测试

### `Test_UpdateService()`
- 创建Sedna和Kubernetes的伪客户端。
- 创建old service，其中包含了对云端worker和边端worker的配置信息。创建两种模型资源。
- 根据old service创建创建deployment和pod资源。
- 初始化控制器controller，为其设置伪客户端、pod列表、deployment列表。
- 控制器的`sendToEdgeFunc`被设置为一个空函数（不执行实际的边缘通信）。
- 复制了旧的联合推理服务，并修改边缘worker中的硬示例挖掘参数，将其值从`value1`更改为`value2`，同时增加了服务的`Generation`值。
- 调用控制器的`updateService`函数，触发对联合推理服务的更新。
- 测试验证了是否成功通过伪客户端获取到更新后的联合推理服务。
- 检查更新后的HEM参数是否已从`value1`正确更新为`value2`，确保服务更新逻辑正确执行。

