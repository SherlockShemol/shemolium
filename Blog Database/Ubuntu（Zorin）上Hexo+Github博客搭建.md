---
lang: [zh-CN, en-US]
date: "2023-10-05"
type: "Post"
slug: "hexo-github-blog-build-on-ubuntu"
tags: [流程记录]
summary: "参考知乎文章，参考文章更加详细，但是和参考文章有出入的地方请以我的文章为主。"
status: "Published"
---

# Ubuntu（Zorin）上Hexo+Github博客搭建

参考知乎文章，参考文章更加详细，但是和参考文章有出入的地方请以我的文章为主

[https://zhuanlan.zhihu.com/p/35668237](https://zhuanlan.zhihu.com/p/35668237)

# 安装Node.js

```plain text
sudo apt install nodejs
```
一开始就遇到了版本问题，Ubuntu上的版本太老了，应该把nodejs应该升级到最新版本
[https://askubuntu.com/questions/426750/how-can-i-update-my-nodejs-to-the-latest-version](https://askubuntu.com/questions/426750/how-can-i-update-my-nodejs-to-the-latest-version)
Use [n module from npm](https://www.npmjs.com/package/n) in order to upgrade node

```plain text
sudo npm cache clean -f
sudo npm install -g n
sudo n stable
```
To upgrade to latest version (and not current stable) version, you can use

```plain text
sudo n latest
```
- Fix PATH:

```plain text
sudo apt-get install --reinstall nodejs-legacy     # fix /usr/bin/node
```
- To undo:

```plain text
sudo n rm 6.0.0     # replace number with version of Node that was installed
sudo npm uninstall -g n
```
You may need to restart your terminal to see the updated node version.
下面的一部分步骤可以参考原文章，不再赘述

# 安装Hexo
按照官网的方法
[https://hexo.io/index.html](https://hexo.io/index.html)

```plain text
npm install hexo-cli -g
hexo init blog
cd blog
npm install
hexo server
```
如果有步骤错误也许可以尝试一下加sudo？

# 连接Github和本地

```plain text
npm install hexo-deployer-git --save
```

```shell
git config --global user.name "SherlockShemol"
git config --global user.email "shemol@163.com"
```
生成密钥SSH key

```shell
ssh-keygen -t rsa -C "shemol@163.com"
```

```shell
cat ~/.ssh/id_rsa.pub
```
将输出的内容复制到框中，在SSH keys中粘贴，点击确定保存。
输入`ssh -T git@github.com`，如果出现你的用户名，那就成功了。
打开博客根目录下的`_config.yml`文件，这是博客的配置文件，在这里你可以修改与博客相关的各种信息。
修改最后一行的配置：

```shell
deploy:
  type: git
  repository: <https://github.com/SherlockShemol/SherlockShemol.github.io>
  branch: master
```
repository修改为你自己的github项目地址。

# 修改主题
看原博客
我的是[Even主题](https://ahonn.github.io/hexo-theme-even/2021/12/07/getting-started/)，[Github地址](https://github.com/ahonn/hexo-theme-even)
Even主题下npm install报错
[https://sobaigu.com/hexo-renderer-sass-error.html](https://sobaigu.com/hexo-renderer-sass-error.html)
采用

```plain text
npm uninstall hexo-renderer-sass
npm i --save hexo-renderer-sass-next
```
剩下的看文档就可以了

# Hexo部署问题
github新规规定再从hexo提交代码只能用token。
解决方法：
1.去`Seqttings->Developer settings->Personal access tokens->Personal access tokens`生成一个新的令牌
2.`hexo -d`执行完后会有一个对话框提示你输入账号密码。**注意，这里要输入的不是你的密码而是token**
参考：[https://blog.csdn.net/qq_21040559/article/details/122621179](https://blog.csdn.net/qq_21040559/article/details/122621179)

