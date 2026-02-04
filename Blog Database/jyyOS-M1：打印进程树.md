---
lang: [en-US, zh-CN]
date: "2024-10-13"
type: "Post"
slug: "jyyOS-m1-print-pstree"
tags: [操作系统]
summary: "打印进程树实现。"
status: "Published"
---

# jyyOS-M1：打印进程树


🔗 [https://jyywiki.cn/OS/2024/labs/M1.md](https://jyywiki.cn/OS/2024/labs/M1.md)
实现上不一定正确，也有可能随着不断的学习来修改实现，写下这个权当对实验内容的整理和复习，仅供自己参考。

我先尝试从1号进程输出一个pstree，不考虑命令行中的option.
问题可以被分为几个部分：
- 如何得到pid.
- 如何得到ppid.
- 以什么样的方式存储pid和ppid.
- 如何输出树。
- 以及最后需要考虑的问题，如何解析命令行参数。


# 如何存储pid和ppid
选择把`pid` 、`ppid` 和进程名称`name` 定义在一个结构体中。

```c
#define MAX_NAME_LEN 256

typedef struct Process{
	pid_t pid;
	pid_t ppid;
	char name[MAX_NAME_LEN];
}
```
The GNU C Library对`pid_t` 的官方[文档解释](https://www.gnu.org/software/libc/manual/html_node/Process-Identification.html)。
> The `pid_t` data type is a signed integer type which is capable
> of representing a process ID.  In the GNU C Library, this is an `int`.

将所有进程存放在数组中，每个元素都是`Process`结构体。并且定义进程数量。

```c
#define MAX_PROC 1024
struct Process processes[MAX_PROC];
int process_count = 0;
```

# 得到pid和ppid
如实验指导所言， `Everying is a`**` `**`file`（说明相关的C中的函数和API一定是相当重要的）**,**我们可以通过 `/proc` 文件夹下以数字命名的目录来获取进程：

```c
//traverse /proc directory, get all process information
void get_process_list() {
  // read each entry in the proc directory
  struct dirent *entry;
  DIR *dp = opendir("/proc"); // open /proc dir
  
  if(dp==NULL){
    perror("opendir: /proc");
    exit(1);
  }

  while((entry = readdir(dp)) != NULL){
    if (isdigit(*entry->d_name)){
      //printf("Process ID:%s\n", entry->d_name);
      pid_t pid = atoi(entry->d_name);
      if (pid > 0) {
        pid_t ppid;
        char name[MAX_NAME_LEN];

        // read the status file of the process
        if (read_status_file(pid, &ppid, name) == 0) {
          processes[process_count].pid = pid;
          processes[process_count].ppid = ppid;
          strncpy(processes[process_count].name, name, MAX_NAME_LEN);
          process_count++;
        }
      }
    }
  }
  closedir(dp);
}
```
`struct dirent` 的[官方解释](https://www.gnu.org/software/libc/manual/html_node/Directory-Entries.html)。
我自己直接搜members of dirent structure还借助了stack overflow上的[回答](https://stackoverflow.com/questions/12991334/members-of-dirent-structure)。
`DIR data type`的[官方解释](https://www.gnu.org/software/libc/manual/html_node/Opening-a-Directory.html)。

```c
int read_status_file(pid_t pid, pid_t *ppid, char *name) {
  char path[64], buffer[256];
  FILE *file;

  sprintf(path, "/proc/%d/status", pid);
  file = fopen(path, "r");
  if (file == NULL) {
    return -1; //file can't be opened, maybe process already exits
  }

  while (fgets(buffer, sizeof(buffer), file)) {
    if (strncmp(buffer, "Name:", 5) == 0) {
      sscanf(buffer, "Name:\t%s", name);
    }
    else if (strncmp(buffer, "PPid:", 5) == 0) {
      sscanf(buffer, "PPid:\t%d", ppid);
    }
  }

  fclose(file);
  return 0;
}
```
在`read_status_file`函数中，`sprintf`、`fgets`、`strncmp` 以及`sscanf` 的用法对我来说都是比较陌生的，但ChatGPT告诉我这些函数在读取和解析文件内容中都是很常用的。


# 输出树
最容易想到的方法应该就是递归了，将当前进程的`pid`与进程数组中数组们的`ppid` ，进行对比来作为是否可以进入递归函数的条件。不再赘述。


# 解析命令行参数
`getopt_long`真的很好用。
C parse short option and long option in the command line.
这是官方的[定义和示例](https://www.gnu.org/software/libc/manual/html_node/Getopt.html)，我在写代码的时候还借助了[这个示例](https://www.cs.wm.edu/~smherwig/courses/csci415-common/parse-options/index.html)。

jyy老师在实验指导最后提出的问题自己还不能做出解答，继续深入往下学习吧。
