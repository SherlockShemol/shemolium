---
lang: [zh-CN, en-US]
date: "2024-06-10"
type: "Post"
slug: "deploy-kubeedge-edgemesh-sedna"
tags: [流程记录, 云原生]
summary: "部署KubeEdge、EdgeMesh、Sedna过程。"
status: "Published"
---

# 部署KubeEdge、EdgeMesh、Sedna


# 下载keadm
下载`keadm`用于安装KubeEdge，官方文档：[https://kubeedge.io/docs/setup/install-with-keadm/](https://kubeedge.io/docs/setup/install-with-keadm/)
（英文版里有下载的部分中文版文档却没有，就有点迷惑...）

```shell
wget <https://github.com/kubeedge/kubeedge/releases/download/v1.16.2/keadm-v1.16.2-linux-amd64.tar.gz>

tar -zxvf keadm-v1.16.2-linux-amd64.tar.gz
cp keadm-1.16.2-linux-amd64/keadm/keadm /usr/local/bin/keadm

```

# 设置云端（KubeEdge主节点）

```shell
sudo keadm init --advertise-address=主机ip地址 --kubeedge-version=v1.16.2 --set iptablesManager.mode="external" --set cloudCore.modules.dynamicController.enable=true

```
还有一个配置项其实是`--kube-config=/root/.kube/config`，但默认就是这个我就删掉了，如果`config`文件不在默认路径需要设置一下，具体也可以`keadm --help`查看一下。
如果没有成功，可能有很多很多原因啦（心酸）。
一个原因可能是没有移除node上的污点，导致node上无法部署业务服务，解决方法：

```shell
kubectl taint nodes master node-role.kubernetes.io/control-plane:NoSchedule-

```
还有一个原因可能是cloudcore镜像没pull下来，这个时候可以再检查一下给containerd配置的代理是否生效，或者用国内镜像来代替，我当时用的是[渡渡鸟镜像同步站](https://docker.aityp.com/)，搜索的话能看到我当时用的cloudcore v1.16.2版本。

```shell
kubectl edit pod/daemonset/deployment ** -n **

```
然后替换为国内镜像的地址就好了。
我还遇到过`disk pressure`的问题...但是这个应该比较少见。
总之遇到问题积极`describe pod/node`查看日志信息就好啦。
当cloudcore正常运行后，我们就要`keadm gettoken --kube-config=...`查看`token`，准备部署edgecore。

# 设置边端（KubeEdge工作节点）
在边端设备上（已经装好containerd和keadm）：

```shell
sudo keadm join  --kubeedge-version=1.16.2 --cloudcore-ipport="云端ip地址":10000  --remote-runtime-endpoint=unix:///run/containerd/containerd.sock --cgroupdriver=systemd --token=**

```
感觉前面如果都做好了一般没有问题，如果出现问题，记得查看日志，还要多搜搜Github上的issue。

# 部署EdgeMesh
这是我犯错最多的地方，也是花费时间最多的地方，如果没有部署好的话，后面联合推理实例是根本跑不起来的。
官方文档：[https://edgemesh.netlify.app/guide/](https://edgemesh.netlify.app/guide/)

## 开启边缘Kube-API端点功能
- 1.云端开启dynamicController模块
如果是用上面的命令部署的cloudcore，这里是已经开启的，因为我加了`-set cloudCore.modules.dynamicController.enable=true`。
- 2.边缘端打开metaServer 模块，注意配置完成后，要**重启edgecore**。

```yaml
vim /etc/kubeedge/config/edgecore.yaml
modules:
  ...
  edgeMesh:
    enable: false
  ...
  metaManager:
    metaServer:
      enable: true

```
重启edgecore

```shell
systemctl restart edgecore

```
- 3.在边缘节点，配置clusterDNS和clusterDomain，配置完成后，**需要重启edgecore**。

```plain text
$ vim /etc/kubeedge/config/edgecore.yaml
modules:
  ...
  edged:
    ...
    tailoredKubeletConfig:
      ...
      clusterDNS:
      - 169.254.96.16
      clusterDomain: cluster.local
...

```
一定要注意配置的位置（都是泪啊）...
`clusterDNS`的值不要变。
如同文档里说的，clusterDNS 设置的值 '169.254.96.16' 来自于 [commonConfig在新窗口打开](https://edgemesh.netlify.app/zh/reference/config-items.html#edgemesh-agent-cfg) 中 bridgeDeviceIP 的默认值，正常情况下无需修改，非得修改请保持两者一致。
重启edgecore。

```shell
systemctl restart edgecore

```
- 4.最后，在边缘节点，测试边缘Kube-API端点功能是否正常：

```shell
$ curl 127.0.0.1:10550/api/v1/services
{"apiVersion":"v1","items":[{"apiVersion":"v1","kind":"Service","metadata":{"creationTimestamp":"2021-04-14T06:30:05Z","labels":{"component":"apiserver","provider":"kubernetes"},"name":"kubernetes","namespace":"default","resourceVersion":"147","selfLink":"default/services/kubernetes","uid":"55eeebea-08cf-4d1a-8b04-e85f8ae112a9"},"spec":{"clusterIP":"10.96.0.1","ports":[{"name":"https","port":443,"protocol":"TCP","targetPort":6443}],"sessionAffinity":"None","type":"ClusterIP"},"status":{"loadBalancer":{}}},{"apiVersion":"v1","kind":"Service","metadata":{"annotations":{"prometheus.io/port":"9153","prometheus.io/scrape":"true"},"creationTimestamp":"2021-04-14T06:30:07Z","labels":{"k8s-app":"kube-dns","kubernetes.io/cluster-service":"true","kubernetes.io/name":"KubeDNS"},"name":"kube-dns","namespace":"kube-system","resourceVersion":"203","selfLink":"kube-system/services/kube-dns","uid":"c221ac20-cbfa-406b-812a-c44b9d82d6dc"},"spec":{"clusterIP":"10.96.0.10","ports":[{"name":"dns","port":53,"protocol":"UDP","targetPort":53},{"name":"dns-tcp","port":53,"protocol":"TCP","targetPort":53},{"name":"metrics","port":9153,"protocol":"TCP","targetPort":9153}],"selector":{"k8s-app":"kube-dns"},"sessionAffinity":"None","type":"ClusterIP"},"status":{"loadBalancer":{}}}],"kind":"ServiceList","metadata":{"resourceVersion":"377360","selfLink":"/api/v1/services"}}

```
如果返回值是空列表，或者响应时长很久（接近 10s）才拿到返回值，说明你的配置可能有误，请仔细检查。
**完成上述步骤之后，KubeEdge 的边缘 Kube-API 端点功能就已经开启了，接着继续部署EdgeMesh即可。**

## 开始部署EdgeMesh
按照文档中先决条件清除一下污点，添加过滤标签。

```shell
$ kubectl taint nodes --all node-role.kubernetes.io/master-
$ kubectl label services kubernetes service.edgemesh.kubeedge.io/service-proxy-name=""

```
然后手动安装EdgeMesh：
- 从Github上clone下EdgeMesh

```shell
$ git clone <https://github.com/kubeedge/edgemesh.git>
$ cd edgemesh

```
- 创建CRD

```plain text
$ kubectl apply -f build/crds/istio/
customresourcedefinition.apiextensions.k8s.io/destinationrules.networking.istio.io created
customresourcedefinition.apiextensions.k8s.io/gateways.networking.istio.io created
customresourcedefinition.apiextensions.k8s.io/virtualservices.networking.istio.io created

```
- 部署edgemesh-agent
在下面有一个提示，需要修改`build/agent/resources/04-configmap.yaml`文件中relayNodes部分，并重新生成PSK密码。
relaynode一般就配一个云上的节点作为中继，用master，ip就是master节点ip。PSK根据注释中的网址生成一下就可以，不过自己做实验的话其实不生成也行（bushi

```yaml
relayNodes:
- nodeName: cloud #master的名字
  advertiseAddress:
  - *.*.*.*  #master的ip

```
后面的注释掉就好了。
然后部署edgemesh-agent

```plain text
$ kubectl apply -f build/agent/resources/
serviceaccount/edgemesh-agent created
clusterrole.rbac.authorization.k8s.io/edgemesh-agent created
clusterrolebinding.rbac.authorization.k8s.io/edgemesh-agent created
configmap/edgemesh-agent-cfg created
configmap/edgemesh-agent-psk created
daemonset.apps/edgemesh-agent created

```
- 检查一下

```shell
$ kubectl get all -n kubeedge -o wide
NAME                       READY   STATUS    RESTARTS   AGE   IP              NODE         NOMINATED NODE   READINESS GATES
pod/edgemesh-agent-7gf7g   1/1     Running   0          39s   192.168.0.71    k8s-node1    <none>           <none>
pod/edgemesh-agent-fwf86   1/1     Running   0          39s   192.168.0.229   k8s-master   <none>           <none>
pod/edgemesh-agent-twm6m   1/1     Running   0          39s   192.168.5.121   ke-edge2     <none>           <none>
pod/edgemesh-agent-xwxlp   1/1     Running   0          39s   192.168.5.187   ke-edge1     <none>           <none>

NAME                            DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE   CONTAINERS       IMAGES                           SELECTOR
daemonset.apps/edgemesh-agent   4         4         4       4            4           <none>          39s   edgemesh-agent   kubeedge/edgemesh-agent:latest   k8s-app=kubeedge,kubeedge=edgemesh-agent

```
这是官网的检查方法，但感觉没太大用处，就算是`running`也有可能不能正常工作的。
可以在边端

```shell
crictl logs edgemesh的containerID

```
检查一下，看看日志是不是正常的，或者卡在了哪个地方，如果是正常的会有`heartbeat`定期发送。

# 运行EdgeMesh测试案例
墙裂推荐跑一下，能发现很多问题。向前辈求助，前辈也都会先问测试案例有没有跑通。我跑了带星号的那个[跨边云通信测试（Cross-Edge-Cloud）](https://edgemesh.netlify.app/zh/guide/test-case.html#%E8%B7%A8%E8%BE%B9%E4%BA%91%E9%80%9A%E4%BF%A1)。
- 1.部署测试pod。

```shell
$ kubectl apply -f examples/test-pod.yaml
pod/alpine-test created
pod/websocket-test created

```
- 2.部署边云通信测试需要的

```shell
$ kubectl apply -f examples/cloudzone.yaml
namespace/cloudzone created
deployment.apps/tcp-echo-cloud created
service/tcp-echo-cloud-svc created
deployment.apps/busybox-sleep-cloud created

```

```shell
$ kubectl apply -f examples/edgezone.yaml
namespace/edgezone created
deployment.apps/tcp-echo-edge created
service/tcp-echo-edge-svc created
deployment.apps/busybox-sleep-edge created

```
当时实验进行到这一步的时候我遇到了第一个问题，应该被部署到边端，namespace为edgezone的pod一直处于`ContainerCreating`状态，因为Pod没办法被部署上，自然没办法查看日志（`crictl logs containerID`），又没办法从云端查看（`kubectl logs`），`kubectl describe pod`信息量又为0，所以我就`systemctl status edgecore`，终于看到了相关报错信息（虽然好像有更好的方法？），原因是边端`/run/flannel/subnet.env`文件不存在，我看了一下云端有，于是就在边端创造了一份和云端内容相同的文件，过了一小会pod都显示为`running`状态。
- 3.云访问边

```plain text
$ BUSYBOX_POD=$(kubectl get all -n cloudzone | grep pod/busybox | awk '{print $1}')
$ kubectl -n cloudzone exec $BUSYBOX_POD -c busybox -i -t -- sh
$ telnet tcp-echo-edge-svc.edgezone 2701
Welcome, you are connected to node ke-edge1.
Running on Pod tcp-echo-edge.
In namespace edgezone.
With IP address 172.17.0.2.
Service default.
Hello Edge, I am Cloud.
Hello Edge, I am Cloud.

```
我是没有遇到问题的。
- 4.边访问云
官网用的是docker，所以用了`docker ps`，用crictl就直接

```shell
crictl ps
# 找到busybox的containerID，然后
crictl exec -it containerID sh

```
然后我运行

```plain text
$ telnet tcp-echo-cloud-svc.cloudzone 2701

```
出现了问题，大概是`name or server unknow`，这个其实是因为我不小心把边缘Kube-API给配置错了导致的。
然后我配置正确之后，再进行这一步，又出现了问题，显示`no route to host`，和[这个issue](https://github.com/kubeedge/edgemesh/issues/533)问题一样,然后我按照issue里说的[全网最全EdgeMesh Q&A手册](https://zhuanlan.zhihu.com/p/585749690)问题三，清理iptables规则，然后重新部署edgemesh，发现就可以跑通了！太激动了当时。

```plain text
$ telnet tcp-echo-cloud-svc.cloudzone 2701
Welcome, you are connected to node k8s-master.
Running on Pod tcp-echo-cloud.
In namespace cloudzone.
With IP address 10.244.0.8.
Service default.
Hello Cloud, I am Edge.
Hello Cloud, I am Edge.

```
到这里EdgeMesh就算真正部署成功了。不知道因为EdgeMesh我花费了多少时间。不过其实都是学习必须要经历。自己一开始没有看日志的意识，自己瞎尝试解决问题，现在慢慢出问题第一反应找日志，然后就可以快速解决问题。

# 部署Sedna
官方文档：[https://sedna.readthedocs.io/en/latest/setup/install.html](https://sedna.readthedocs.io/en/latest/setup/install.html)

```shell
curl <https://raw.githubusercontent.com/kubeedge/sedna/main/scripts/installation/install.sh> | SEDNA_ACTION=create bash -

```
有一个问题是，这个脚本有时候识别不出来版本号，所以要留意一下它输出的信息，如果没有识别出版本号，中断安装过程，卸载Sedna，然后再试一下。

```shell
# 卸载的命令
curl <https://raw.githubusercontent.com/kubeedge/sedna/main/scripts/installation/install.sh> | SEDNA_ACTION=create bash -

```
然后正常的话就正常运行啦，不正常的话有可能还是需要换成国内镜像。

# 参考文章
- k8s+kubeedge+sedna安装全套流程+避坑指南+解决办法：[https://blog.csdn.net/MacWx/article/details/130200209](https://blog.csdn.net/MacWx/article/details/130200209)
