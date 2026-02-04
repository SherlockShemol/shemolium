---
lang: [zh-CN, en-US]
date: "2024-06-10"
type: "Post"
slug: "install-k8s-and-prep-before-deploy-kubeedge"
tags: [流程记录, 云原生]
summary: "安装k8s前，需要先安装containerd。kubeedge边端只需要安装containerd就好了，云端需要安装k8s。"
status: "Published"
---

# k8s集群安装以及kubeedge部署前准备

> 实验环境：Debian GNU/Linux 12 (bookworm) x86_64

# 安装containerd
安装k8s前，需要先[安装containerd](https://neuromansser.tech/posts/%E5%AE%89%E8%A3%85%E5%AE%B9%E5%99%A8%E8%BF%90%E8%A1%8C%E6%97%B6containerd/)。kubeedge边端只需要安装containerd就好了，云端需要安装k8s。

# 安装k8s前准备

## 设置流量转发
修改 iptables 的配置，启用“br_netfilter”模块，让 kubernetes 可以检查和转发网络流量。

```shell
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
br_netfilter
EOF

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
net.ipv4.ip_forward=1 # better than modify /etc/sysctl.conf
EOF

sudo sysctl --system

```

## 关闭Linux Swap分区
> 基于安全性（如在官方文档中承诺的 Secret 只会在内存中读写，不会落盘）、利于保证节点同步一致性等原因，从 1.8 版开始，Kubernetes 就在它的文档中明确声明了它默认不支持 Swap 分区，在未关闭 Swap 分区的机器中，集群将直接无法启动。

```shell
sudo cp /etc/fstab /etc/fstab_bak
sudo swapoff -a
sudo sed -ri '/\\sswap\\s/s/^#?/#/' /etc/fstab

```

## 注册apt软件源
选择清华镜像源，官方文档为：[https://mirrors.tuna.tsinghua.edu.cn/help/kubernetes/](https://mirrors.tuna.tsinghua.edu.cn/help/kubernetes/)

```shell
sudo apt install -y apt-transport-https ca-certificates curl

sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg <https://packages.cloud.google.com/apt/doc/apt-key.gpg>

```
新建`/etc/apt/sources.list.d/kubernetes.list`，内容为：

```shell
deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] <https://mirrors.tuna.tsinghua.edu.cn/kubernetes/apt> kubernetes-xenial main

```
然后

```shell
sudo apt update

```

# 安装kubeadm，kubelet，kubectl
三个工具的作用请自行学习。

```shell
sudo apt install kubeadm kubelet kubectl

```
个人没有锁定版本，如果有锁定版本的需要，请阅读参考文章。
查看安装结果：

```shell
cloud@cloud:~$ kubeadm version
kubeadm version: &version.Info{Major:"1", Minor:"28", GitVersion:"v1.28.10", GitCommit:"21be1d76a90bc00e2b0f6676a664bdf097224155", GitTreeState:"clean", BuildDate:"2024-05-14T10:51:30Z", GoVersion:"go1.21.9", Compiler:"gc", Platform:"linux/amd64"}
cloud@cloud:~$ kubectl version
Client Version: v1.28.10
Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3
The connection to the server localhost:8080 was refused - did you specify the right host or port?
cloud@cloud:~$ kubelet --version
Kubernetes v1.28.10

```
了解后续需要的镜像版本：

```shell
cloud@cloud:~$ sudo kubeadm config images list --kubernetes-version v1.28.10
registry.k8s.io/kube-apiserver:v1.28.10
registry.k8s.io/kube-controller-manager:v1.28.10
registry.k8s.io/kube-scheduler:v1.28.10
registry.k8s.io/kube-proxy:v1.28.10
registry.k8s.io/pause:3.9
registry.k8s.io/etcd:3.5.12-0
registry.k8s.io/coredns/coredns:v1.10.1

```

# 初始化集群控制面
1.启动kubelet，保证开机执行

```shell
sudo systemctl start kubelet
sudo systemctl enable kubelet

```
2.开始部署，这里切换到root账号

```shell
kubeadm init \\
--image-repository registry.cn-hangzhou.aliyuncs.com/google_containers \\
--pod-network-cidr=10.10.0.0/16 \\
--apiserver-advertise-address=10.129.196.8 \\
--kubernetes-version=v1.28.10 \\
--v=5

```
参数解释（这里直接摘抄原参考文章啦）：
- `-image-repository`：从阿里云服务器上拉取上面需要的基础镜像，如果不设置，就得去 Google 服务器拉取；
- `-pod-network-cidr`：设置集群中 Pod 的网络地址段，这是给后面安装网络插件 Flannel 使用的；
- `-kubernetes-version`：指定 Kubernetes 版本；
- `-v=5`：显示详细的跟踪日志，可以参考[这里](https://kubernetes.io/zh-cn/docs/reference/kubectl/cheatsheet/#kubectl-output-verbosity-and-debugging)；
- `-apiserver-advertise-address`：指定 api-server 的 IP 地址，如果有多张网卡，请明确选择哪张网卡。由于 apiserver 在 Kubernetes 集群中有很重要的地位，很多配置（如 ConfigMap 资源等）都直接存储了该地址，后续更改起来十分麻烦，所以要慎重。
3.按照日志提示进行kube config配置
我的做法是在root下，后续kubeedge部署时，默认的config文件就在`$HOME/.kube/config`，也就是`/root/.kube/config`。

```shell
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config

```

## 安装网络插件
关于k8s的网络插件，请自行学习，我也需要再学习一下...
这里我们按照原参考文章一样选择Flannel。
从 [Github](https://github.com/flannel-io/flannel/blob/master/Documentation/kube-flannel.yml) 获取安装文件 kube-flannel.yml，然后对其进行修改：

```plain text
net-conf.json: |
    {
      "Network": "10.244.0.0/16",
      "Backend": {
        "Type": "vxlan"
      }
    }

```
将上面的 Network 调整为我们之前初始化集群时设置的 pod 网段：

```yaml
net-conf.json: |
    {
      "Network": "10.10.0.0/16",
      "Backend": {
        "Type": "vxlan"
      }
    }

```
最后我们使用 `kubectl apply` 进行安装：

```plain text
kubectl apply -f kube-flannel.yml

```
也可以按照flannel官网的方式直接

```shell
kubectl apply -f <https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml>

```
感觉版本的话都可以问题不大，但是不管怎么样pod网段应该都需要配置的。

### 有一个小问题需要注意
在后续运行edgemesh测试案例的过程中，发现部署在边端的pod始终处于`ContainerCreating`的状态，边端的edgecore日志显示原因是`/run/flannel/subnet.env`不存在，把云端的这个文件内容复制到边端之后才可以正常部署。因此可以留意一下这个问题，在部署edgemesh的时候我还会再说一遍。

## 关于镜像
在没有设置containerd的代理之前，我遇到了flannel镜像无法拉取的问题，我推荐一个我使用的国内镜像源替代的方法。
在[渡渡鸟镜像同步站](https://docker.aityp.com/)搜索相关的镜像，`kubectl edit pod/deployment/daemonset ** -n **`直接替换为国内的镜像。如果渡渡鸟镜像同步站没有相关镜像的话，也可以按照网站的[使用指南](https://docker.aityp.com/article/1)进行添加。

## 移除master上的污点
移除污点是为了让 master 节点可以部署业务服务，当时部署cloudcore的时候就因为这个问题耽误了一些时间...

```shell
kubectl taint nodes cloud node-role.kubernetes.io/control-plane:NoSchedule-

```
参考文章中的调整NodePort范围，目前我还没有遇到问题，因此先跳过了，需要的请阅读参考文章。
增加Worker节点也暂时没有必要，需要的请阅读参考文章。

# 安装Docker
此外，在运行联合推理案例时，需要构建联合推理头盔检测大小模型的镜像（运行案例中的build_image.sh脚本，这个到时候也会说），因此需要安装docker ce。
清华镜像源安装docker ce，官方文档：[https://mirrors.tuna.tsinghua.edu.cn/help/docker-ce/](https://mirrors.tuna.tsinghua.edu.cn/help/docker-ce/)
另外Docker也最好配置代理和国内镜像，请自行搜索方法。

# 参考文章
- Kubernetes 集群安装（Debian 版）：[https://demonlee.tech/archives/2212002#移除-master-上的污点](https://demonlee.tech/archives/2212002#%E7%A7%BB%E9%99%A4-master-%E4%B8%8A%E7%9A%84%E6%B1%A1%E7%82%B9)
