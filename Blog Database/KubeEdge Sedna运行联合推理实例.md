---
lang: [zh-CN, en-US]
date: "2024-06-10"
type: "Post"
slug: "kubeedge-sedna-run-jointinference-service"
tags: [流程记录, 云原生]
summary: "利用KubeEdge Sedna运行联合推理实例。"
status: "Published"
---

# KubeEdge Sedna运行联合推理实例

按照上篇文章已经部署好了KubeEdge、EdgeMesh和Sedna，接下来按照官方文档运行联合推理实例。
官方文档：[https://sedna.readthedocs.io/en/latest/examples/joint_inference/helmet_detection_inference/README.html#](https://sedna.readthedocs.io/en/latest/examples/joint_inference/helmet_detection_inference/README.html#)
其实只要之前的EdgeMesh正确部署，这个实例只要按照文档不会出问题。

# 准备数据和模型
- 下载小模型到边端

```shell
mkdir -p /data/little-model
cd /data/little-model
wget <https://kubeedge.obs.cn-north-1.myhuaweicloud.com/examples/helmet-detection-inference/little-model.tar.gz>
tar -zxvf little-model.tar.gz

```
- 下载大模型到云端

```shell
mkdir -p /data/big-model
cd /data/big-model
wget <https://kubeedge.obs.cn-north-1.myhuaweicloud.com/examples/helmet-detection-inference/big-model.tar.gz>
tar -zxvf big-model.tar.gz

```
- 准备镜像
小模型推理worker：`kubeedge/sedna-example-joint-inference-helmet-detection-little:v0.3.0`
大模型推理worker：`kubeedge/sedna-example-joint-inference-helmet-detection-big:v0.3.0`

```shell
git clone <https://github.com/kubeedge/sedna.git>
./examples/build_image.sh joint_inference # 后面加joint_inference就只生成联合推理的镜像，不加的话就把包括联邦学习那些都生成了

```
如果很慢的话，我的做法是在构建镜像的文件中（`joint-inference-helmet-detection-big.Dockerfile`和`joint-inference-helmet-detection-little.Dockerfile`）加入

```plain text
RUN sed -i s@/archive.ubuntu.com/@/mirrors.aliyun.com/@g /etc/apt/sources.list
RUN apt-get clean
RUN pip config set global.index-url <http://mirrors.aliyun.com/pypi/simple>
RUN pip config set install.trusted-host mirrors.aliyun.com
RUN pip install --upgrade pip

```
添加apt和pip镜像源。

# 创建联合推理服务
（kubectl的操作全是在云端进行）
- 为云端创建大模型资源对象

```shell
kubectl create -f - <<EOF
apiVersion: sedna.io/v1alpha1
kind:  Model
metadata:
  name: helmet-detection-inference-big-model
  namespace: default
spec:
  url: "/data/big-model/yolov3_darknet.pb"
  format: "pb"
EOF

```
- 为边缘端创建小模型资源对象

```shell
kubectl create -f - <<EOF
apiVersion: sedna.io/v1alpha1
kind: Model
metadata:
  name: helmet-detection-inference-little-model
  namespace: default
spec:
  url: "/data/little-model/yolov3_resnet18.pb"
  format: "pb"
EOF

```
在边端创建文件夹，生成的推理图片结果都生成在文件夹中：

```shell
mkdir -p /joint_inference/output

```
在云端定义环境变量CLOUD_NODE和EDGE_NODE

```shell
CLOUD_NODE="cloud-node-name"
EDGE_NODE="edge-node-name"

```
在云端创造联合推理服务,我把其中的镜像替换成国内镜像了，以下是文件内容：

```yaml
kind: JointInferenceService
metadata:
  name: helmet-detection-inference-example
  namespace: default
spec:
  edgeWorker:
    model:
      name: "helmet-detection-inference-little-model"
    hardExampleMining:
      name: "IBT"
      parameters:
        - key: "threshold_img"
          value: "0.9"
        - key: "threshold_box"
          value: "0.9"
    template:
      spec:
        nodeName: $EDGE_NODE
        dnsPolicy: ClusterFirstWithHostNet
        containers:
        - image: swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/kubeedge/sedna-example-joint-inference-helmet-detection-little:v0.3.0
          imagePullPolicy: IfNotPresent
          name:  little-model
          env:  # user defined environments
          - name: input_shape
            value: "416,736"
          - name: "video_url"
            value: "rtsp://localhost/video"
          - name: "all_examples_inference_output"
            value: "/data/output"
          - name: "hard_example_cloud_inference_output"
            value: "/data/hard_example_cloud_inference_output"
          - name: "hard_example_edge_inference_output"
            value: "/data/hard_example_edge_inference_output"
          resources:  # user defined resources
            requests:
              memory: 64M
              cpu: 100m
            limits:
              memory: 2Gi
          volumeMounts:
            - name: outputdir
              mountPath: /data/
        volumes:   # user defined volumes
          - name: outputdir
            hostPath:
              # user must create the directory in host
              path: /joint_inference/output
              type: Directory
  cloudWorker:
    model:
      name: "helmet-detection-inference-big-model"
    template:
      spec:
        nodeName: $CLOUD_NODE
        dnsPolicy: ClusterFirstWithHostNet
        containers:
          - image: swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/kubeedge/sedna-example-joint-inference-helmet-detection-big:v0.3.0
            name:  big-model
            imagePullPolicy: IfNotPresent
            env:  # user defined environments
              - name: "input_shape"
                value: "544,544"
            resources:  # user defined resources
              requests:
                memory: 2Gi
EOF

```

# 边缘端模拟视频流进行推理
- 1.安装开源视频流服务器 EasyDarwin。
- 2.启动 EasyDarwin 服务器。
- 3.下载视频。
- 4.向推理服务可连接的网址（如 `rtsp://localhost/video` ）推送视频流。
（EasyDarwin-linux-8.1.0-1901141151.tar.gz在文档上给的地址应该是找不到了，但是我在一个网站上找到并且下载下来了）

```shell
cd EasyDarwin-linux-8.1.0-1901141151
./start.sh

mkdir -p /data/video
cd /data/video
wget <https://kubeedge.obs.cn-north-1.myhuaweicloud.com/examples/helmet-detection-inference/video.tar.gz>
tar -zxvf video.tar.gz

ffmpeg -re -i /data/video/video.mp4 -vcodec libx264 -f rtsp rtsp://localhost/video

```
正常运行的话，pod都是`running`状态，而且可以在 JointInferenceService 配置中定义的输出路径（如 `/joint_inference/output` ）中查看推理结果。
