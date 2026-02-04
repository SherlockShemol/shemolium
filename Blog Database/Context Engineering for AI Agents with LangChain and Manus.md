---
lang: [en-US, zh-CN]
date: "2025-10-20"
type: "Post"
slug: "Context-Engineering-for-AI-Agents-with-LangChain-and-Manus"
tags: [Agent]
summary: "learning notes of context engineering"
status: "Published"
---

# Context Engineering for AI Agents with LangChain and Manus

months ago Manus post a blog talking about Context Engineering.
[https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
You don’t need all context to live in the messages history of your agent, so we need context offloading.

# Langchain experience

## offload context to a file system
So one of the most popular ideas here is just using a **file system**.
Take the output of a tool message as an example, dump it to the file system, send back to your agent just some minimal piece of information necessary so it can reference the full context if it needs to, but that full payload, for example, web search result that's very token-heavy, isn't spammed into your context window for perpetuity.
offloading context takes some piece of information, like a tool message that's token-heavy, and not sending it all back to your messages list, but dumping it to a file system where it can be retrieved only as needed.

## Reduce context
Summarize or compress information to reduce context.Summarizing tool call outputs is one intuitive way to do this.So this idea of pruning old tool calls with tool outputs or tool messages is something that Claud is now kind of built into their their SDK.
Cognition(an agent application) also talks about idea of summarizing approving at agent-to-agent handoffs.

## Retrieve Context
Claude Code Force only uses the file system and simple search tools, notably glob and grep. So there's different ways to retrieve context on demand for your agent.
Indexing and something like semantic search, file system and simple file search tools, both can be highly effective.

## Context isolation
Context isolation is major, in particular splitting context across multi-agents.
Each sub-agent has its own context window and sub-agents allow for separation of concerns.

## Caching Context
langchain open deep research 
[https://github.com/langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research)

![](../_assets/Context Engineering for AI Age_1770869899254.png)

![](../_assets/Context Engineering for AI Age_1770869900279.png)
It has three phases: scoping of the research, the research phase itself using a multi-agent, basically architecture, and then a final one-shot writing phase. We use offloading, so we basically create a brief to scope our research plan.
We offload that so we don't just save that in the context window because that context window is going to get peppered with other things.
We offload it so it's saved independently, it can be accessed in our case from the line graph state, but it could also be from file system, it's the same idea.
So you create a research plan, you offload it, it's always accessible. You go do a bunch of work, you can pull that back in on demand so you can put it kind of at the end of your message list so it's accessible and readily available to your agent to perform, for example, the writing phase.
We use offloading, as you can see, to help steer the research and writing phases. We use reduction to summarize observation from token-heavy surf tool calls, that's done inside research itself.
And we use context isolation across sub-agents within research itself. And this is kind of a summary of a bunch of different, uh, of these various ideas across a bunch of different projects.

# Manus experience
instead of building specialized models too early, uh, startups really should lean on general models and context engineering for as long as possible.

## Context Reduction: Compaction vs. Summarization
For compaction, in Manus, every tool call and tool result we actually has two different formats: a full format and a compact one.
The compact version strips out any information that can be like reconstructed from the file system or external state. For for example, here, let's say you have a a tool that writes to a file and it probably has two fields, a path and a content field.
And but once the tool returns, you can ensure that the file already exists in the environment. So in the compact format, we can safely drop the super long content field and just keep the path.
And if your agent start is smart enough, well like whenever it needs to read that file again, it can simply retrieve it via the path. So no information is truly lost. It's just like externalized.
We think this kind of like reversibility is crucial because agents do like chain predictions based on previous actions and observations and you never know like which past action will suddenly become super important like 10 steps later.
You cannot predict it. So this is a a reversible reduction by using compaction.
Of course, like compaction only take you so far. Eventually like your context will will still grow and will hit the ceiling, and that's when we combine compaction with the more like traditional summarization, but we do it very carefully.
For example, here, before summarizing, we might offload key parts of the context into files. And sometimes like we even more do more aggressively, we can dump the entire pre-summary context as a text file or simply a log file into the file system so that we can like always recover it later.
And like Lance, like just mentioned some people just use like glob and grep. You know, glob also works for log files. So if the model is smart enough, it even knows how to retrieve those like summarized , those pre-summarized context.
the difference here is that **compaction is reversible, but summarization isn't**. Both reduce context lengths, but they behave very differently.

to make both methods coexist, we have to track some like context length thresholds. At the top like you'll have your models hard context limit, say like 1 million tokens, pretty common today.
But in reality most models start degrading much earlier, typically maybe around 200k, and you'll begin to see what we call a context rot, like repetitions, slower inferences, degraded quality.
So by doing a lot of evaluation, it's very important for you to identify that pre-rot threshold, it's typically 128K to to 200K, and use it as the trigger for context reduction.
And whenever like your context size approaches it, you have to trigger context reduction, but starting from compaction, not summarization.
And compaction doesn't mean like compressing the entire history. You know, we might compact like the oldest 50% of tool calls while keeping the newer ones in full detail so the model still has fresh view shot examples to of like how to use tools properly.
Otherwise like in the in the worst case, the model will will imitate the behavior and output those compact format with with missing fields and that's totally wrong.
And after compaction, we have to check how much free context that we actually gain from this like like compaction operation. Sometimes like in this graph, after multiple rounds of compaction, the gain is tiny because like even it's compact, it still uses context.
And that's when we go for summarization, but also keep in mind that when summarizing, we always use the full version of the data, not the compact one.
And we still like keep the last few tool calls and tool results in full detail, not summary, because it can allow the model to know where it left off and will continue like like more smoothly.
Otherwise, you'll see like after summarization sometimes the model will change its style, change its tone, and we find out like keeping a few few like tool call tool result examples really help.

## Context Isolation:Communicating vs. Sharing Memory
Cognition's blog shows that they warn against using multi-agent setups because like when you have multiple agents syncing information between them becomes a nightmare.
**Multi-process or multi-thread coordination** has been a classic challenge in the early days of computer programming, and I think we could borrow some wisdoms here.
in the Go programming language community there's a famous quote from this gopher, "Do not communicate by sharing memory, instead share memory by communicating.”
[https://chatgpt.com/share/68f4f8c3-baac-8004-9cf7-421375260909](https://chatgpt.com/share/68f4f8c3-baac-8004-9cf7-421375260909)
Of course, this isn't directly about agent and it's sometimes even wrong for for for agents, but I think the important thing is it highlights two distinct patterns here which is by communicating or by sharing memory.
Like if we translate the term memory here into context, we can see that parallel pretty clear. "By communicating" is like the easier one to understand because it is the classic sub-agent setup here.
For example, the main agent writes a prompt and it, the prompt is sent to a sub-agent, and the sub-agent's entire context only consists of that instruction.
We think if a task has a like short, clear instruction and only the final output matters, say like searching a codebase for a specific snippet, then just use the communication pattern and keep it simple.
Because the main agent doesn't care how the sub-agent find the code, it only needs the result.
And this is what Claud Code does, typically using its like task tool to delegate like a separated clear task to some sub-agents.
But for more complex scenarios, in contrast, "by sharing memory" means that the sub-agent can see the entire previous context. It means like all the tool use, tool use history, tool usage history, but it, the sub-agent has its own system prompt and its own action space.
For example, imagine a deep research scenario, the final report depends on a lot of intermediate searches and notes. And in that case, you should consider using the share memory pattern or in our language "by sharing context," because even you can save all that notes and and searches into file and making the the sub-agent to read everything again, but you're just wasting latency and context.
And if you count the amount of token, maybe you're using even more token to to do this. so we think for those scenario that requires a full history, just use a share memory pattern.
But be aware that sharing context is kind of expensive because each sub-agent has a larger input to prefill, which is like you'll spend more on like input tokens, and since the system prompt and the access space differs, you cannot re-reuse the KV cache, so you have to pay the full price.

## Context Offloading:Layered Action Space
when people say offload, they usually mean like moving parts of the working context into external files.
But as system grows, especially if you decide to integrate MCP one day, you realize that the tools themselves can also take up a lot of context, and having too many tools in context leads to confusion.
We call it context confusion, and the model might call like the wrong ones or even like non-existing ones.
So we have to find a way to also offload the tools. A common approach right now is like doing dynamic RAG on tool descriptions,  for example like loading tools on demand based on the current task or the current status.
But that also causes two issues. First of all, like since tool definitions sit at the front of the context, your KV resets every time.
And most importantly, the model's past calls to remove tools are still in the context, so it might foot the model into like calling invalid tools or invalid or using invalid parameters.

So to address this, Manus is experimenting with a new layered action space. essentially, we can let Manus to choose from three different levels of abstractions: number one, function calling, number two, sandbox utilities, and number three, packages and API.
We go deeper into into these three layers of layer action space. Let's start from level one, function calling, and this is a classic, everyone knows it. It is schema safe thanks to constraint decoding, but we all know the downsides.
For example, we mentioned like breaking the cache and maybe too many tool calls will cause some confusion, too many tools may cause confusion.
So Manus uses a fixed number of atomic functions, for example like reading and writing files, executing shell commands, searching files in internet, and maybe some like browser browser operations.
these atomic functions have super clear boundaries, and they can work together to compose like much more complex workflows.
Then we offload everything else to the next layer, which is the sandbox utilities. As you know, each Manus session runs inside a full virtual machine sandbox. It's running on our own customized Linux system, and that means Manus can use the shell commands to run pre-install utility that we develop for Manus.
For example, we have some format converters, we have like speech recognition utilities, and even a very special, we call it MCP CLI which is how we call MCP.
We do not inject MCP tools to the function colony space. Instead, we do everything inside that sandbox through in the command line interface.
And utilities are great because you can add new capabilities without touching the model's model's calling space, and you know it's just some like commands pre-installed in your computer.
And if you're familiar with Linux, you always know how to find those new commands and you can even run like like d-help to to to to to to figure out how to use a new tool.

And another good thing is for larger outputs, they can just write to files or return the result in pages.
And you can use all those Linux tools like grep, cat, less, more, like to to to to to process that results on the fly. So the trade-off here like it's it's super good for large outputs, but it's also not that good for low latency back and forth interactions with the front end.
Because you always have to visualize the interactions of your agent and show it to the user.
And then we have another layer, the final layer, we call it packages and APIs. You know, here Manus can write Python scripts to call pre-authorized API or custom packages.
For example, Manus might use a 3D designing library for modeling or call a financial API to fetch market data. And here actually we've purchased all these API on behalf of a user and pay the money for them.
It's included in the subscription. So we basically we have a lot of like API keys pre-installed in Manus and Manus can access these APIs using the keys.
I think these are perfect for task that requires lots of computation in memory, but do not need to push all that data into the model context.
For example, imagine if you're analyzing a stock's entire year of price data, you don't feed the model all the numbers. Instead, you should let the script to compute it and only put the summary back into the context.
And you know, since code and APIs are super composable, you can actually chain a lot of things in one step.
For example, in a typical API, you can get city names, get city ID, get weather, all in one Python script.
There's also a paper like from one of my friend called Code Act. A lot of people were like discussing about it. I think it it's like the same idea because like code is composable and it can like like like do a lot of things in one step.
But also it's like it's not schema safe. It's very very hard to do like a strange decoding on codec.
So we think you should find the right uh scenario for these features. For us, we use all as we mentioned everything that's like that can handle inside a like like compiler or interpreter runtime, we do that using code.
Otherwise, we use like sandbox utilities or function calls.
And the good thing is if you have these three layers from model's point, all three levels still go through the standard function calls, so the interface stays simple, cache friendly, and orthogonal across functions.
Because you know, we mentioned sandbox utilities, you're still accessing these tools using the shell tool, accessing these tools using the shell function.
And also like if you're using APIs in third-party applications, you're just using the file function to write or read file and then execute it, execute it using the shell function.
So you think it does not add like like add overhead to the model. It's still all the things that models are trained and they're already familiar with.

## Connecting the Five Dimensions and Avoiding Over-engineering
Let's zoom out and connect the five dimensions: offload, reduce, retrieve, isolate, and cache. You can find find out that they are not independent.
**We can see that offload and retrieve enables more efficient reduction and stable retrieve makes isolation safe, but isolation, oh yeah, isolation also slows down contacts and reduces the frequency of reduction.**
However, more isolation and reduction also affects cache efficiency and the quality of output. So at the end of the day, I think context engineering is the science in art that requires a perfect balance between multiple potentially conflicting objectives.
I want to leave with maybe one final thought, and it's kind of the opposite of everything I just said, which is **please avoid context over-engineering**.
looking back at the at the like past six or seven months since Manis launch, actually the biggest leap we've ever seen didn't came from like adding more fancy context management layers or clever retrieval hacks.
They all came from simplifying or from removing unnecessary tricks and trusting the model a little more.
Every time we simplify the architecture, the system got faster, more stable, and smarter, because we think context engineering should uh, the goal of context engineering is to make the model's job simpler, but not harder.
So if you like take one thing from today, I think it should be **build less and understand more**.

# Q&A

## Q&A - Shell Tools and Sandboxing
Q: how does the LLM call the various shell tools? How does it know which tools exist and how to invoke them?
Maybe you can explain a little bit about kind of the multi the multi-tier kind of sandboxing setup that you use with Manus.
A: First of all, we have a hint in the system prompt telling Manas that, hey, there's a lot of pre-installed command line utilities located in some specific folder.
And also like for the most like frequently used ones, we already like injected in the system prompt, but it's super compact. We do not like tell the the agent how to use the tools.
We only list them and we can tell the agent that you can use the the the `--help` uh flag safely because all the utilities are developed by our team and they have the same format.

## Q&A - Indexing vs. File System for Context Retrieval
Q: I know you talked a lot about using file system. What's your take on using indexing, um, and do you utilize like do you spin up vector stores on the fly if the context you're working with gets sufficiently large?
A:there's no no right and wrong in this space, like you've mentioned, uh, but at Manis we do not use index databases because right now, you know, every sandbox in Mana session is a new one and user want to like interact with things fast, so actually we don't have the time to like build the index on the fly.
So we're more like Claude Code, we rely on like like grep and and and glob. But I think like if you like consider to build some something like more long-term memory or like if you want to integrate some like like enterprise knowledge base, you still have to rely on that like um like external vector index because like it's only about the the amount of information that you can access.
But for like Manus like it operates in a sandbox and for coding agent, you operate in the codebase, so it it depends on the scale.

Q:So let's say I'm a user, I have my Manus account, I interact with Manas across many sessions. Do you have the notion of memory?
So Claude has Claude MD files, they persist across all the different sessions of Claude Code. How about you guys? How do you handle kind of long-term memory?
A:actually in Manus we have a concept called knowledge, which is kind of like like explicit memory.
For example, like every time you can tell Manas, hey, remember like uh every time I ask for something, deliver is in maybe in Excel, and it's not automatically inserted into some memory.
It will pop up a a dialogue and say, here's what I learned from our previous conversation and would you like accept it or reject it? So this is the explicit one, it requires user confirmation.
but also like we are discovering new ways to do it more automatically. For example, like um uh, a pretty interesting uh thing in agents is that like compared to chatbots, user often like correct correct the agent more oftenly.
For example, like a common uh mistake that Manas make is when doing like data visualization, you know, if you're using Chinese, Japanese, or Korean, a lot of time there will be some font issues and there will be errors in those render render visualizations.
So the user will often say like, hey, you should like use use like not and CJK font. And for these kind of things, the user will will a different user will will have the same correction and we need to maybe they'll find out a way to like to leverage these kind of a collective feedback and use it.
That's kind of like we call it self-improving agent with online learning, but in a parameter free way.

## Q&A - Adapting to Evolving Models
Q: You mentioned towards the end of your talk that, um, you you gained a lot from removing things, and a lot of that is probably because of the fact that also the models are getting better.
So model capabilities in increasing and so you can kind of remove scaffolding over time. How do you think about this?
Because this is one of the biggest challenges that I've faced is like over time the model gets better, and I can remove things like certain parts of my scaffolding, so you're building on top of this, the the foundation that's like the water's rising.
do you revisit your architecture every some number of months with new releases and just delete as the models get better, and how do you how do you approach that problem?
A: this is a super good good question here because you know, actually we have already um refactored Manis for five times, and we've launched Manis in March and now it's October already, five times.
So we think like you cannot stop because like models are not only improving, but they are changing. Models' behaviors are changing over time.
one way is you can you can work closely with those like model providers, but we also have another like internal theory for how we evaluate or how we design our agent architecture.
I cover a little bit on Twitter before. It's basically like we all, we do not care about a the the a static the performance of a static uh benchmark.
Instead, we like we fix the AR agent architecture and we switch between models.
If if like your architecture can gain a lot from switching from a weaker model to a stronger model, then somehow your your architecture is more future-proof because like the the the the weaker model tomorrow is might be as good as a stronger model today.
so we think like switching like between uh weaker and strong models can give you some like early signals of what will happen next year and give you some time to prepare your architecture.
for Manus, um, we often like do these kind of review like every every one or two months, and we often like um, do some like um, yeah, do some like like research internally using like open source models and maybe like early access to prep proprietary models to like prepare the the the next release like even before the launch of the next model.

## Q&A - Data Storage Formats
What about um best practices or considerations for um format for storing data?
So like markdown files, plain text, log, uh, anything you prefer in particular?
I think obviously it's, yeah, how do you think about that kind of file formats for?
A: I think like like it's the not about like plain text or markdown, but we always like prioritize line based um formats because like it allows like the models to use like grep or like read from read from a range of range of lines.
And also like markdown can sometime cause some troubles. You know, um, models are trained train trained to use markdown really well, and sometimes it will maybe for for for for some model, I don't I don't want to say that name, but but they often like output too many bullet points if you use markdown too too often.
Yeah, so actually we we want to use more plain text.

## Q&A - Prompting for Summarization
How about on the topic of um compaction versus summarization?
Let's hit on summarization. This is an interesting one that I've been asked a lot before, uh, how do you prompt to produce good summaries?
So for example, summarization like you said, it's irreversible, so if you don't prompt it properly, you can actually lose information.
The best answer I came up with is just tuning your prompt **for high recall,** but how do you approach this?
how do you think about prompting for summarization?
A:we tried a lot of a lot like optimizing the prompt for summarization, but it turns out a simple approach works really well is that you do not use a free form like prompt to let the AI generate everything.
Instead, you could define a kind of a schema. It's just a form, there's a lot of fields and let the AI to fill them.
For example, like here are the files that I that I've modified and here's the goal of the user, here's what I left off.
And if you use this kind of like a more structured schema, at least like like the output is kind of stable and you can iterate on this, so just do not use like free form summarizations.

## Q&A - Compaction of Search Results
How about with context, how about with compaction then?
And actually, I want to make sure I understood that. So with compaction, let's say it's a like a search tool, you have the raw search tool output and would it be that would be your raw message and then the compaction would just be like uh a file name or something, is that right?
A:Yeah, it is. It's not only about like the tool call, it's also like applied to the to the result of the tool.
we interestingly we find out that almost every every action in Manas is just kind of like reversible if you can offload it to a to the file system or an external state.
for most of these tasks, you already have a unique identifier for it. For example, for file operations, of course, you have the file path.
For like browser operations, you have the URL, and even for search search um actions, you have the query.
So it's it's naturally it's already there.
Lance: And just want to hit that again because it I've had this problem a lot. So for example, I'm an agent that uses search, I perform a, it returns a token-heavy tool call.
I don't want to return that whole tool message to um the agent.
I've done things like some kind of summarization or compaction and send the summary back, but how do you approach that because you might want all that information to be accessible for the agent for his next decision, but you don't want that huge context block to live inside your message history?
So how do you approach that? You could send the whole message back uh, but then remove it later, that's what Claude does now.
You could do a summarization first and send the summary over. Um, you could do you could send everything and then do compaction so that later on you don't have the whole context in your message history.
You only have like a link to the file. How do you think about that specifically if you see what I'm saying?
A: I know actually it depends on the scenario. For for example, like for like complex search, I mean for complex search, I mean it's not just one query.
For example, like you have multiple queries and you want to like like gather some important things and drop everything else.
in this case, I think we should use sub-agents or internally we call it agent as tool. So for the from the model's perspective, it's still a kind of function, maybe called advanced search.
It's a function called event search, but what it triggers is actually another sub-agent, but that sub-agent is more like a workflow or agentic workflow that has a fixed output schema, and that is the result that returns to the agent.
But for like other kinds of more simpler search, for example, just like searching Google, like we just use the full detail format and like append it into the context and rely on the compactions thing.
But also like we always like instruct the model to like write down like the intermediate insights or key findings into files in case that like the compaction happens earlier than than the model expected.
And if you like do this really well, actually you don't lose a lot of information um by compaction because sometimes like those like old tool calls are irrelevant after time.

## Q&A - Agent-to-Agent Communication & MapReduce
Q:I like the idea of agent as tool, we do that quite a bit and that does make that that is that is highly effective, but that brings up another interesting point about, and and you referenced this a little bit, agent agent communication.
How do you address that?
So Walden Yen from from Cognition had a very nice blog post talking about this is like a major problem that they have with Devin.
so like kind of communication between agents, how do you think about that problem and yeah, ensuring sufficient information is transferred but not overloading like you said the prefill of the sub-agent with too much context?
A: we've launched a feature called Wide Research a month ago, like it's basically like we call, yeah, internally we call it agentic map reduce because we we got inspired from the design of MapReduce.
And it's kind of special for Manus because, there's a full virtual machine behind the session, so one way we pass like information or pass context from the main agent to sub-agent is by sharing the same sandbox.
So the file system is there and you can only pass like the like different path here.
And I think like like sending information to sub-agent is not that hard. The the more more complex thing is about how to like like have the the correct output from different agents.
And what we did here is like we have a trick for every every time if the main agent want to spawn up a new sub-agent or or maybe 10 sub-agents, you have to design, you have to let the main agent to to define the output schema.
And in the in the sub-agent perspective, you have a special tool called `submit_result`, and we use constraint decoding to ensure that what the the sub-agent submits back to to the main agent is the schema that is defined by the main agent.
Yeah, so you can imagine that this kind of MapReduce operation, it will generate a kind of like spreadsheet and the spreadsheet is constrained by the schema.
Lance:That's an interesting theme that seems to come up a lot with how you design Manus, you use schemas and structured outputs both for summarization and for this agent agent communication.
So it's kind of like use schemas as contracts between agent sub-agent or between like a tool and your agent to ensure that sufficient information is passed in a structured way in a complete way uh, like when you're doing summarization, you use a schema as well.

## Q&A - Model Choice and Open Models
I'm poking around some other interesting questions here. Uh, any thoughts on models like uh, I think you guys are use Anthropic, but do you work with open models?
do you do fine-tuning? You talked a lot about kind of working with KV cache, so for that, maybe using open models.
How do you think about like model choice?
A: actually right now we don't use any like open source model right now because I think it's not about quality, it's interestingly it's about cost.
we often think that open source model can lower the cost, but if you're at the scale of Manis and and if you're building a real agent, which the input is way longer than the output, then KV cache is super important.
And distributed KV cache is very hard to implement if you use like open source solutions.
if you use like those like um frontier pro uh LLM providers, they have more solid infrastructure for like distributed cache uh globally.
So sometimes like if you do the math, uh at least for Manis, we find out that using like like these flagship models can sometimes can they can be even more cheaper than like using open source models.
And right now, we're not only using Anthropic force.
Like Anthropic's model is the best choice for like agentic task, but we're also like seeing like the progress in Gemini and in Open New model.
I think right now like these like frontier labs are not converging in directions. For example, like if you're doing coding, of course, you should use uh Claude.
And if you uh want to do like more multimodal multimodality things, you should use Gemini.
And open model is super good at like like complex math and reasoning. So I think for application companies like us, one of our advantage is that we do not have to build on top of only one model.
You can do some like task level routing or maybe even subtask or step level routing if you can like like calculate like if you can can pull in that kind of KV hash validation.
So I think it's advantage for us and we do a lot of evaluations internally to know which models to use for which subtask.
Lance:with KV cache, so what specific features from the or, yeah, what from the providers are you using for cache management?
I know like Anthropic has input caching as an example.

## Q&A - Tool Selection and Layered Action Space (Revisited)
Q:tool selection is a good one. Um, right, so you were talking about this, you don't use like uh, indexing of tool descriptions and fetching tools on the fly based on semantic similarity.
How do you handle that? Like what's what's the threshold for too many tools?
tool choice is a classic. How do you think about that?
A: first of all, it depends on the model. Different model has different capacity for like tools, but I think a rule of thumb is try not to like um include more than like 30 tools.
It's just a random number in my mind, but actually I think like if you're building a we call it a general AI agent like Manis, you want to make sure those like native functions are super atomic.
So actually there are not that much like atomic function that we need to put inside the action space.
So like for Manus, we right now we only have like like 10 or 20 like atomic function, and everything else is in the sandbox.
we don't have to like um to pull things like dynamically.
Lance:Let's explain that a little bit more, so so you have, let's say, 10 tools that can be called directly um by the agent, but then I guess it's like you said the agent can also choose to for example write a script and then execute a script.
So that expands its action space hugely without giving it like you don't have an independent tool for each possible script, of course, that's insane.
So so our very general tool to like write a script and then run it does a lot.
A:why we are super confident to call Manis a general agent?
Because it runs on a computer, and computers are Turing complete. The computer is the best invention of human.
Like theoretically, like an agent can do anything that an maybe a junior intern can do using a computer.
So with the shell tool and the and the text editor, we think it's already complete, so you can offload a lot of things right to sandbox.
Lance:You mentioned code with code agents. My understanding is the model will actually always produce a script and that'll then be run inside a code sandbox for so every tool call is effectively like a script is generated and run.
It sounds like you do some hybrid where sometimes Manas can just call tools directly, but other times it can actually choose to do something in the sandbox, is that right?
A:I think this is this is super important because like actually we try to use entirely to use uh Codec for Manas, but the problem is if you're using code, you cannot leverage like constraint decoding and things can go wrong.
Codec has some like special use cases as I mentioned earlier in slides, for example, like processing a a large amount of data.
You don't have to like port everything in the tool result.
It's that you put it inside like maybe the runtime memory of Python and you only get the result back to to the model.
So we think you should do it like in a hybrid way.

## Q&A - Planning and To-Do Lists
Q: Tell me about planning and and I know Manus has this to-do tool or it generates a to-do list and start of tasks.
A:at the beginning Manus uses that `to-do.md` paradigm.
it's kind of, I I don't want to use the word stupid, but actually it wastes a lot of turn.
You know, um, like back in maybe March or April, like if you like check the log of some Manas task, maybe like one-third of the action is about like updating the the to-do list.
It wastes a lot of like like tokens.
so right now we're using a more like structuralized planning. For example, like uh, if you use Manus, there's a planner at the bottom of like the system.
Internally, it's also kind of a tool called it's, we implemented using the agent as tool paradigm so that like there's a separate agent that that is managing the plan.
So actually right now the latest version of Manus, we are no longer using that `to-do.md` thing. 
like `todo.md` still works and it can generate like good results, but if you want to say save tokens, you can find another way.

## Q&A - Multi-Agent Design and Roles
So you might have like a planning agent with its own context window, makes a plan, produces like some kind of plan object, maybe it's a file or maybe it just calls sub-agents directly.
How do you think about that like and how many different sub-agents do you typically recommend using?
A: I think this is also like depends on your design, but here at Manis actually Manis is not kind of like the typical multi-agent system.
For example, like we've seen a lot of like different agent that divides by role.
For example, like you have a designer agent or design or like programming agent, manager agent, we don't do that because we think like uh why we have this is because this is how like human company works and this is due to the limitation of like human context.
So in Manus, Manas is a multi-agent system, but we do not divide by role.
We only have very few agents. For example, we have a huge like general executor agent and a planner agent and a knowledge management agent and maybe like some some, yeah, data API registration agent.
so we are very very cautious about adding more sub-agents because of the reason that we've mentioned before, communication is very hard.
And we implement more kinds of like sub-agents as agent as tools as we mentioned before.
Lance:I see this mistake a lot, or I don't know if it's a mistake, but you see anthropomorph, anthropomorphizing agents a lot like it's my designer agent, and I think it's kind of a forced analogy to think about like a human org chart in your sub-agents.
it's like a planner and knowledge manager. A knowledge manager might do what like um, like what will be the task of knowledge manager like?
A:we mentioned like we have a knowledge system in Manus.
What the knowledge agent does is that it reviews like the conversation between the user and the agent and and figure out like what should be like saved in in the long-term memory.

## Q&A - Safety and Guardrailing in Sandboxed Environments
How about guardrailing? Someone asked a question about kind of safety and guardrailing.
A: if you have a sandbox that's connected to the internet, everything is dangerous.so we have put a lot of effort like in guard railing, like at least we do not let the information to get out of the sandbox.
For example, like if you like got prompt injected, uh, we have some like uh checks on like outgoing traffic.
For example, like we'll ensure that no like token things will go out of the sandbox.
And if the the user wants to like print something out of the sandbox, we have those kind of like like like um what we call it uh removing, yeah, removing things and to to ensure that no information go out of the sandbox.
But you know, um, for another kind of thing is that we have a browser inside of Manus, and the browser is very complicated.
For example, like if you log into some like um your websites, you can choose to let Manis to persist your login state, and this turns out to be like like very tricky because like sometime the content of the web page can also be like malicious, maybe they they're doing like like prompt injection.
And this, I think, is somehow like out of scope for application company. So we're moving uh, we're working very closely with those computer use model provider.
For example, like Anthropic and Google. Yeah, they're adding a lot of guardrails here.
So right now in Manas, every time you do some like sensitive operations whether or inside the um the browser or in the sandbox, Manas will will require a manual confirmation and you must accept it or otherwise you have to take over it to finish it yourself.
So I think like it's pretty hard for us to like design a a like kind of a very like well-designed solution, but it's a progressive approach.
So right now we're letting the user to take over more frequently, but like if the guard rail itself in the model gets better, we can do less.

## Q&A - Evaluation Strategies
How about the topic of evals? This has been discussed a lot quite a bit online if you probably seen, you know, Claude Code, they talked a lot about just doing less formal evals at least for code because code evals are more or less saturated, lots of internal dog fooding.
How do you think about evals? Are they useful? What evals are actually useful?
What's your approach?
A:Yes, yeah, you know, at the beginning uh, at the launch of Manis, we're using like public academic benchmarks like Gaia, but then like after after launching to the public, we find out that it's super misaligned.
models are that that gets like high scores on Gaia, the user don't like it.
So right now we use like three, we have three different kinds of evaluations.
First of all, most importantly is that for every like completed session in Manas, we'll request the user to like give a feedback to give one to five stars.
this is the gold standard. Like we always care about like the average user rating. This is number one.
And number two, we're still using some like like internal automated tests with like verifiable results.
For example, like we have like created our own data set with like clear answers. But also like uh we, yeah, we we still use a lot of like public academic benchmarks, but we also uh created some um some data sets that's more focused on execution because like most benchmark out there are more about like read-only tasks.
So we designed some like like um like executing tasks or transactional task because we have the sandbox, we can like frequently reset the test environment.
So these are the automated parts. And most importantly, number number three, we have a lot of interns, you know, you have to use a lot of real human interns to do like like uh evaluations on things like website generation or data visualization because like it's very hard to design a good reward model that knows whether the output is visually appealing.
**it's about the taste.**

## Q&A - RL with Verifiable Rewards vs. Tool Calling Agents
I do want to ask you about this emerging trend of of reinforcement learning with verifiable rewards versus just building tool calling agents.
So like Claude Code, extremely good, and they have the benefit because they built the harness and they can perform RL on their harness and it can get really really good with the tools they provide in the harness.
Do you guys do RL um, or how do you think about that?
Because of course, in that case, you would have you using open models.
I've been playing with this quite a bit lately. How do you think about that, just like using tool calling out of the box with model providers versus doing RL yourself inside your environment with your with your with your harness?
A:I've been doing like free training, post training, RL for a lot of years, but I have to say that right now if you like if you have like in um like sufficient resource, you can try.
But actually like we, as I mentioned earlier, MCP is a big changer here because like if you want to support MCP, you're not using a fixed action space.
And if it's not a fixed action space, it's very very hard to design a good like reward, and you cannot generate a lot of like the the rollouts and feedbacks will be unbalanced.
So if you want to build a model using like that supports MCP, you are literally building a foundation model by yourself.
So I think like every everyone in the in the community like model companies they're doing the same thing.
They're doing the same thing for you. So right now I don't think we should spend that much time on doing RL right now, but like as I mentioned earlier, we are just discovering like like exploring new ways to do like maybe call it like personalization or some sort of online learning, but using like parameter freeway.
For example, like collective feedbacks.
Lance: one little one along those lines is is it the case that for example Anthropics done reinforcement learning at verified rewards on some set of tools using Claude Code.
Have you found that you can kind of mock your your your harness to use similar tool names to kind of unlock the same capability if that makes sense?
Like um, for example, like I believe they've just, you know, they've obviously performed, you know, they it utilized glob, uses GP, uses some other set of tools for manipulating the file system.
Can you effectively reproduce that same functionality by having the exact same tools with the same tool name, same descriptions in your harness or kind of how do you think about that like unlocking um, unlocking the, yeah, right, you see what I'm saying?
A:I know the clear answer here, but for us we actually try not to use the same name because like it it will like if you design your own function, you maybe have like different requirements for that function, and the parameters, the input arguments might be different.
So you don't want to like confuse the model like if the model is trained on a lot of like post training data that has some like internal tools, you don't want to to to let the models to be confused.
