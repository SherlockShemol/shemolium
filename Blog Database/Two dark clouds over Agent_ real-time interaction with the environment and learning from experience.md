---
lang: [zh-CN, en-US]
date: "2025-10-19"
type: "Post"
slug: "two-dark-clouds=over-agent"
tags: [Agent]
summary: "对 boj老师agent 上两朵乌云的学习"
status: "Published"
---

# Two dark clouds over Agent: real-time interaction with the environment and learning from experience

[https://01.me/files/agent-learn-from-experience/dist/1](https://01.me/files/agent-learn-from-experience/dist/1)
Co-Founder & Chief Scientist, Pine AI

The Challenge of real-time interaction
- high latency in voice interaction (tens of seconds)
- GUI operation is 3-5 times slower than human actions
- the serial bottleneck of the traditional ReAct loop
technical breakthrough
- SEAL architecture（Streaming, Event-driven Agent Loop）
  - perception layer: Streaming processing of speech signals
  - thinking layer: Interactive ReAct with asynchronous observation, thinking, and action
  - execution layer: feedback Loop VLA/TTS

The challenge of learning from experience
core challenge
- Every task starts from scratch
-  Unable to accumulate domain knowledge
- lack of proficiency improvement

three major paradigns of agent learning from experience 
1. Post-training：RL parameter update
2. In-context Learning：Attention soft update
3. Externalized Learning：
  - RAG: persistent Experience Storage
  - Tool Generation: Agent Self-Evolution

Scientist Shunyu Yao pointed out the first issue: the lack of interaction with real people during an agent’s task execution, and the second issue: the absence of a mechanism for learning from experience.
(So I went to read that blog)

## **The Second Half - Shunyu Yao**
[https://ysymyth.github.io/The-Second-Half/](https://ysymyth.github.io/The-Second-Half/)
In the first half, we continuously developed new training methods and models, achieving consistent results in benchmark tests. We kept creating more challenging benchmarks and consistently scored high on these tests, cycling through this process repeatedly. Ultimately, we found an effective method capable of achieving generalization: reinforcement learning.
This recipe has been largely standardized and requires little new thinking; as long as the above cycle is continuously followed, performance can keep improving. Therefore, a fundamental rethinking of the evaluation method is necessary.
The issue is that despite using AI to defeat world champions in chess and Go, surpass most humans on the SAT and bar exams, and achieve gold-medal levels in competitions, the world hasn't changed much—at least from an economic or GDP perspective.
The author refers to it as the utility problem.
Previous evaluation settings differ from the real-world setup in many ways. Two examples:
- Evaluations should run automatically. Typically, an agent receives a task and acts autonomously, subsequently earning a task reward. However, in reality, the agent must continuously interact with humans throughout the entire task process—you can’t just send an extremely long message to customer support, wait ten minutes, and expect to receive a detailed reply that solves all your problems.
- The evaluation "should" follow the independent and identically distributed (i.i.d.) principle. If the test set contains 500 tasks, each task must be executed independently, and the overall evaluation result is derived by aggregating task metrics. However, in reality, task processing tends to be sequential rather than parallel. As Google engineers become more familiar with the codebase, their ability to handle Google3 issues continuously improves; meanwhile, software engineering agents—even when addressing numerous problems within the same codebase—fail to achieve such incremental progress. We clearly need long-term memory mechanisms ([existing methods](https://yitaoliu17.com/assets/pdf/ICLR_2025_CER.pdf) already enable this), but academia lacks both suitable benchmarks to validate its necessity and the academic courage to question the foundational assumption of machine learning: the i.i.d. hypothesis.
In the first half of artificial intelligence development, these assumptions established benchmarks without issue, as enhancing intelligence typically increased utility when AI capabilities were relatively low. However, universal methodologies now ensure effectiveness under these assumptions. Thus, the key to navigating the new landscape of the second half lies in:
- Develop novel evaluation settings or tasks for practical applications.
- Solve problems according to the established plan, or refine the solution by introducing innovative elements. Repeat this cycle.
While the first half of the game is filled with incremental approaches and models, the second half will, to some extent, filter them out. Unless new premises that break conventions can be established, universal solutions will completely overshadow those gradual methods—only then will there be an opportunity to pursue truly disruptive research.
and I came across an expression that struck me as incredibly clever. I absolutely adore the following passage:
> Thinking, or reasoning, is a **strange** kind of action - 
> it does not directly affect the external world, yet the space of 
> reasoning is open-ended and combintocially infinite — you can think 
> about a word, a sentence, a whole passage, or 10000 random English 
> words, but the world around you doesn’t immediate change. In the 
> classical RL theory, it is a terrible deal and makes decision-making 
> impossible. Imagine you need to choose one out of two boxes, and there’s
>  only one box with $1M and the other one empty. You’re expected to earn 
> $500k. Now imagine I add infinite empty boxes. You’re expected to earn 
> nothing. But by adding reasoning into the action space of any RL 
> environment, we make use of the language pre-training priors to 
> generalize, and we afford to have flexible test-time compute for 
> different decisions. It is a really **magical** thing and I
>  apologize for not fully making sense of it here, I might need to write 
> another blog post just for it. You’re welcome to read [ReAct](https://arxiv.org/abs/2210.03629)
>  for the original story of reasoning for agents and read my vibes at the
>  time. For now, my intuitive explanation is: even though you add 
> infinite empty boxes, you have seen them throughout your life in all 
> kinds of games, and choosing these boxes prepare you to better choose 
> the box with money for any given game. My abstract explanation would be:
>  **language generalizes through reasoning in agents**.

# Section 1: Agent interaction with environment in real-time

## Real-time interaction challenges of voice agents

### Fundamental contradiction: Serial processing vs. real-time requirements
- Must wait: first listen, then think; only after thinking can one speak.
- Blocking wait: Every link becomes a bottleneck
  - user finish speaking(VAD)→speech recognition(ASR)→ complete sentence
  - complete sentence → llm with thinking → complete output after thinking
  - complete thinking → split into sentences→Speech synthesis(TTS) → voice response
- cumulative delay: The total delay far exceeds human tolerance

### The dilemma of fast versus slow response
fast response make mistakes easily and slow response burns the users’ patience.
unable to Anticipate and deliberate while listening

### technology bottleneck
perception phase
- voice:Waiting for the entire sentence to end before converting to text results in high latency; feeding fragmented speech into the speech recognition model leads to low recognition accuracy.
- vision:High prefill latency for 2K token screenshots
thinking phase
- Complete input is required to think.
- Unable to predict user intent.
- Test-time scaling exacerbates the delay.
execution phase
- only can act when think ends
- Every step of the GUI operation requires taking a new screenshot for consideration.

# architecture innovation:SEAL(Streaming,Event-driven Agent Loop)
Core idea: Abstract all interactions into asynchronous event streams to achieve low-latency, interruptible real-time interaction.
1. perception layer
Converting continuous real-world signals (speech, GUI video) into discrete event streams
1. thinking layer
Async event processing, think while listening, speak while thinking, generate interleaved sequences of thought and action.
1. execution layer
Converting discrete action commands back into continuous real-world signals (TTS voice, mouse movements)

![](../_assets/Two dark clouds over Agent_ re_1770869824890.png)

## Layer 1 perception layer
input: sequential signal:voice stream,GUI video stream
output:speech_start,interrupt,laugh,speech_fragment,ui_change etc.
Streaming speech perception model replacing VAD+ASR
Streaming Speech-Aware Models Based on Open-Source Autoregressive LLMs
- Unlike traditional ASR models such as Whisper, which use an autoregressive architecture, this approach reduces speech recognition latency.
  - Streaming processing of input speech tokens
  - Streaming text and acoustic events
- Based on open-source LLM post-training
  - Retaining dialogue context and supporting in-context learning significantly improve the recognition accuracy of user personal information and domain-specific terminology.
  - With world knowledge and common sense, the recognition rate for brand names, amounts, etc., has significantly improved.

The output information is rich, encompassing not only text but also acoustic events.
Real-time transcription text segment
Special Tokens（Acoustic event）：
- <speak_start>
- <speak_end>
- <interrupt>
- <emotion:happy>
- <laugh><sigh>
- <music>

## Layer 2:thinking Layer
Based on an event-driven loop, it enables interruptible and asynchronous listening while thinking, and speaking while thinking.
Input
discrete event stream(from event queue)
output
Interlaced thoughts and action commands

## core innovation:interactive ReAct
traditional ReAct

![](../_assets/Two dark clouds over Agent_ re_1770869826813.png)
Interactive ReAct:

![](../_assets/Two dark clouds over Agent_ re_1770869827574.png)

## Interactive ReAct:Think while Listening
traditional ReAct:Once interrupted, all previous thoughts are invalidated and must be started over from the beginning.
Interactive ReAct:Preserve the interrupted thought process and, after adding new user input, allow the model to continue thinking based on previous context.

## Interactive ReAct:Speak while Thinking
Use "preludes" to strive for deep thinking about events and reduce first-character delay.

## Layer 3:Execution Layer
Convert discrete action commands into continuous real-world signals.
Input
speak(…),click(…)
Output
sequential signal(Voice waveform, mouse trajectory)

## last mile for GUI operation
The agent struggles to output coordinates. Solution: Draw inspiration from the VLA model in the field of Robotics and perform post-training on the model using RL, enabling it to directly output actions.
- Option 1: The main model directly outputs mouse click coordinates.
- Option 2:Train a standalone VLA model to mimic human mouse movement patterns:Adopting a closed-loop feedback model of "move, fine-tune, click.”
More human-like in speech synthesis: Generate labeled text, then produce speech with TTS.

![](../_assets/Two dark clouds over Agent_ re_1770869828406.png)

# Agent learning from experience
Paradigm 1: Post-Training
Method: Parameter Update (Post-training)
- Update weights through gradient descent
- Requires a large amount of annotated data
- The model is fixed after training.
- The learning process is slow and expensive.
Paradigm Two: In-Context Learning
Method: In-context Learning
- Implicit learning through the attention mechanism.
- Using long context as temporary memory
- Learning effects are limited to the current conversation and are not permanent.
Paradigm Three: Externalized Learning
Method: Externalizing Knowledge and Processes
- RAG: Efficient, Reliable, Hallucination-Free Knowledge
- Tool-generation: Codify processes to achieve self-evolution.
- Transcending the limitations of parametric knowledge
Best Practice: Contextual Embeddings + Contextual BM25+Reranking + Top-20 chunks

Fine-tuning vs. RAG: An Empirical Comparison of Knowledge Injection Methods
Based on the paper: Fine-Tuning or Retrieval? Comparing Knowledge Injection in LLMs
[https://aclanthology.org/2024.emnlp-main.15.pdf](https://aclanthology.org/2024.emnlp-main.15.pdf)
Core insight of the paper: RAG is not only more effective but also avoids the issues of knowledge forgetting and hallucinations that may arise from fine-tuning.

Tool Generation - Enabling Agent Self-Evolution
[https://arxiv.org/abs/2505.20286](https://arxiv.org/abs/2505.20286)
Minimum Predefined Principle
- Minimalist Architecture: Equipped with only a single core component (Web proxy)
- Avoid over-engineering: Do not presuppose complex tools and workflows.
- Generality first: Reduce domain-specific hardcoding
Maximum Self-Evolution Mechanism
core ability
1. Self-create tools: Generate new tools based on task requirements.
2. Capability Enhancement: Iteratively improve the performance of existing tools
3. Experience Reuse: Solidifying successful patterns into reusable components.

MCP-Zero Active Tool Discovery
Traditional methods dilemma:
- Full injection: The complete toolset occupies a large number of tokens → Context explosion.
- Static retrieval: Based on initial query selection, unable to predict task evolution. Debugging files requires file system + code analysis + command execution.
MCP-Zero: From Passive to Active
Core Concept: Enabling Agents to Proactively Identify Capability Gaps and Request Tools On-Demand
1. Active Tool Request: Agent generates structured requirements
2. Hierarchical Semantic Routing: First Filter Servers, Then Match Tools
3. Iterative Capability Expansion: Dynamically Discovering and Building Toolchains During Execution

Externalizing learning to transcend the limitations of attention is an inevitable trend.

The biggest lesson that can be read from 70 years of AI research is that general methods that leverage computation are ultimately the most effective, and by a large margin. 
