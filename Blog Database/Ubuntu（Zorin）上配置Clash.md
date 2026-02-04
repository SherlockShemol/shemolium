---
lang: [zh-CN, en-US]
date: "2023-10-30"
type: "Post"
slug: "configure-clash-on-ubuntu"
tags: [流程记录]
summary: "Ubuntu（Zorin）上配置Clash过程。"
status: "Published"
---

# Ubuntu（Zorin）上配置Clash

**文中有些文件建议提前下载好，否则可能因为网络问题无法下载，建议先浏览全文**
参考文章：[http://jemlab.cn/?p=141](http://jemlab.cn/?p=141)

# 下载clash并配置
- 使用以下命令下载Clash最新版本

```plain text
wget <https://github.com/Dreamacro/clash/releases/download/v1.18.0/clash-linux-amd64-v1.17.0.gz>

```
一般是换到新系统要重新配置这些东西？所以建议提前下载好存到U盘上或者哪里，要不然到时候从Github下载只能碰运气。
- 进入该文件所在目录，解压

```plain text
gunzip clash-linux-amd64-v1.18.0.gz

```
- 将clash-linux-amd64-v1.18.0文件重命名为clash

```plain text
mv clash-linux-amd64-v1.18.0 clash

```
- 在此目录下创建文件夹（注意这里用大写Clash只是为了和clash区别开）

```plain text
mkdir Clash

```
- 移动clash文件到Clash文件夹中

```plain text
mv clash ./Clash

```
- 进入Clash文件夹

```plain text
cd Clash

```
- 下载clash配置文件`config.yaml` （注意：这个订阅链接是自己的，替代 \[订阅链接\]，如果失败了说明订阅链接有问题）

```plain text
wget -O config.yaml [订阅链接]

```
注意：如果步骤7失败了也没关系，直接跳过这一步，后面也会自动下载。也可以在网址[Country.mmdb](https://link.zhihu.com/?target=https%3A%2F%2Fgithub.com%2FLoyalsoldier%2Fgeoip%2Freleases%2Fdownload%2F202212010123%2FCountry.mmdb)下载。
注意：也建议可以提前下载好，要不然到时候可能因为网络问题下载不成功
- 启动clash

```plain text
chmod +x clash
./clash -d .

```
- 打开系统设置，点击网络，找到系统代理，选择手动
> HTTP代理：127.0.0.1：7890
> HTTPS代理：127.0.0.1：7890
> SOCKS代理：127.0.0.1：7891
即可启动系统代理
- 访问 [http://clash.razord.top/](http://clash.razord.top/) 。代理模式建议选为**规则**
HOST、端口、密钥我记得不用输入，点击保存和确定就可以了。可以直接在面板上切换节点

# 配置开机自启动
可能有些需要管理员权限，记不清楚了。`Permission denied`就在前面加`sudo`
- 创建service文件

```plain text
touch /etc/systemd/system/clash.service

```
- 编辑service文件

```plain text
vim /etc/systemd/system/clash.service

```
- 编辑如下文本（vim的使用方法请自行搜索

```plain text
Description=clash daemon
[Service]
Type=simple
User=root
ExecStart=/home/username/下载/Clash/clash -d /home/username/下载/Clash/ Restart=on-failure
[Install]
WantedBy=multi-user.target

```
其中`ExecStart`中地址是clash的具体所在地址，要根据自己Clash文件夹做修改
- 设置 Clash 的开机启动项，检查状态，服务启动成功之后，根据信息设置自己客户端的代理协议类型及端口（依次输入）

```plain text
sudo systemctl daemon-reload
sudo systemctl enable clash
sudo systemctl start clash
sudo systemctl status clash

```

# 后记
在使用Arch linux以及Ubuntu、Zorin时按照以上步骤都是没有问题的。但是当我换到Fedora时，我发现会出现权限不足的问题。

```plain text
$ sudo systemctl status clash

● clash.service - A rule based proxy in Go for shitao.
   Loaded: loaded (/usr/lib/systemd/system/clash.service; disabled; vendor preset: disabled)
   Active: failed (Result: exit-code) since Tue 2019-06-18 17:27:18 CST; 4s ago
  Process: 6777 ExecStart=/usr/bin/clash (code=exited, status=203/EXEC)
 Main PID: 6777 (code=exited, status=203/EXEC)

Jun 18 17:27:18 localhost.localdomain systemd[1]: Started A rule based proxy in Go for shitao..
Jun 18 17:27:18 localhost.localdomain systemd[6777]: clash.service: Failed to execute command: Permission denied
Jun 18 17:27:18 localhost.localdomain systemd[6777]: clash.service: Failed at step EXEC spawning /usr/bin/clash: Permission denied
Jun 18 17:27:18 localhost.localdomain systemd[1]: clash.service: Main process exited, code=exited, status=203/EXEC
Jun 18 17:27:18 localhost.localdomain systemd[1]: clash.service: Failed with result 'exit-code'.
```
解决方案：修改 `selinux` 成被动模式

```plain text
sudo vim /etc/sysconfig/selinux
```

```plain text
SELINUX=permissive
```
