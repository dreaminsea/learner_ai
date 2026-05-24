# Learner_AI 详细实现计划

## 1. 项目定位

Learner_AI 是一个以 LLM 为核心的主动学习应用。它不是简单地生成一份学习资料清单，而是把「学习计划」「讲义生成」「学习检测」「知识网络」「AI 问答」组合成一个持续更新的学习闭环。

核心闭环：

1. 用户提出学习目标，例如「我要学习数学分析」。
2. 系统通过对话澄清用户基础、目标、时间安排和学习偏好。
3. AI 生成结构化学习计划，并拆成可执行的阶段、每日任务、讲义、练习和检测。
4. 用户按计划学习，系统提醒、检测、记录完成情况。
5. 用户的学习内容、掌握情况和知识点关系被写入知识网络。
6. 用户可以基于自己的知识网络继续向 AI 提问，AI 根据当前学习状态给出个性化回答和下一步建议。

## 2. 产品目标

### 2.1 必须实现的能力

1. 详细学习计划生成
   - 支持用户输入宽泛目标，例如「学习数学分析」「准备机器学习入门」。
   - 能将目标拆成章节、主题、每日任务和阶段验收。
   - 每日任务不止是阅读清单，而要包含学习目标、讲义、例题、练习、检测题和复习建议。

2. 可交互计划书
   - 计划可以在应用内查看、展开、编辑和标记完成。
   - 用户能查看今日任务、历史完成情况、即将到来的内容。
   - 系统可以提醒用户学习，并根据完成情况调整后续安排。

3. 讲义生成
   - AI 为每个知识点生成适合用户水平的讲义。
   - 讲义应包含动机、概念解释、例子、常见误区、练习和小结。
   - 后续应支持参考 Web、PDF、图片教材内容来增强质量。

4. 学习检测
   - 每个任务或知识点都能生成检测题。
   - 用户作答后，AI 评估掌握程度，给出反馈。
   - 检测结果写入知识网络，影响下一步计划。

5. 知识网络
   - 将学科知识拆成节点和边。
   - 节点表示概念、定理、方法、题型、技能等。
   - 边表示前置依赖、相似关系、应用关系、推导关系等。
   - 节点记录用户掌握度、最近学习时间、相关讲义和检测记录。

6. 基于知识网络的 AI 问答
   - 用户能围绕自己的学习进度提问。
   - AI 回答时要参考用户已经学过什么、哪些知识点薄弱、当前计划阶段是什么。
   - 回答后可以更新知识网络，例如新增节点、调整掌握度、记录误区。

### 2.2 和普通 LLM 应用的差异

普通 LLM 应用通常只输出一份静态计划。Learner_AI 要做到：

1. 计划是结构化数据，可以被应用操作，而不是纯文本。
2. 学习过程会被记录，并持续改变计划和知识网络。
3. AI 不只是回答问题，还主动推动用户完成学习任务。
4. 学习资料不是「请读某本书」，而是直接生成讲义、练习和检测。
5. 知识网络成为长期记忆和个性化问答的核心上下文。

## 3. 技术原则

1. 模块解耦
   - Renderer 层只负责 UI 展示和用户交互。
   - Main / 后端服务负责文件、数据库、系统通知、AI 调用和工具调度。
   - AI 编排、知识网络、计划管理、资料读取等功能拆成独立模块。

2. 类型优先
   - 全项目使用 TypeScript。
   - 学习计划、知识节点、检测记录、AI 消息等核心对象都定义明确类型。
   - Renderer 和后端之间通过 typed IPC 或共享 contract 交互。

3. 可扩展
   - LLM provider 先接 DeepSeek API，但抽象为统一接口，后续可切换 OpenAI、Claude、本地模型等。
   - Web search、PDF read、Image read、Agent team 都作为 tool/plugin 接入，不和业务逻辑硬编码在一起。
   - 知识网络存储和展示分离，后续可替换图数据库或可视化库。

4. 可验证
   - AI 输出尽量使用 JSON schema 或结构化格式。
   - 对计划、讲义、检测题、知识网络更新做 schema 校验。
   - 关键流程保留测试：计划生成、节点更新、IPC contract、数据持久化。

5. 渐进实现
   - 先做本地单用户桌面应用。
   - 先做可用的学习闭环，再逐步增强搜索、PDF、图片和多 Agent 能力。

## 4. 推荐目录结构

```text
learner_ai/
  src/
    main/
      app.ts
      ipc/
        plan.ipc.ts
        lecture.ipc.ts
        graph.ipc.ts
        chat.ipc.ts
        settings.ipc.ts
      services/
        planService.ts
        lectureService.ts
        assessmentService.ts
        knowledgeGraphService.ts
        reminderService.ts
        chatService.ts
      ai/
        llmClient.ts
        deepseekClient.ts
        promptRegistry.ts
        structuredOutput.ts
        agents/
          plannerAgent.ts
          lecturerAgent.ts
          assessorAgent.ts
          graphAgent.ts
      tools/
        webSearchTool.ts
        pdfReaderTool.ts
        imageReaderTool.ts
        toolRegistry.ts
      persistence/
        database.ts
        migrations/
        repositories/
          planRepository.ts
          graphRepository.ts
          chatRepository.ts
          settingsRepository.ts
      notifications/
        desktopNotification.ts
    preload/
      index.ts
      api.ts
    renderer/
      app.tsx
      routes/
        DashboardPage.tsx
        PlanPage.tsx
        LecturePage.tsx
        KnowledgeGraphPage.tsx
        ChatPage.tsx
        SettingsPage.tsx
      components/
      features/
        plan/
        lecture/
        graph/
        chat/
        assessment/
      styles/
    shared/
      types/
        plan.ts
        lecture.ts
        graph.ts
        assessment.ts
        chat.ts
        ai.ts
      schemas/
      constants/
  docs/
    architecture.md
    prompts.md
    data-model.md
  plan.md
```

说明：

1. `src/shared` 保存前后端共用的类型和 schema。
2. `src/main/services` 放业务逻辑，不直接写 UI。
3. `src/main/ai` 放 LLM 调用、prompt、agent 编排。
4. `src/main/tools` 放外部能力，例如搜索、PDF、图片识别。
5. `src/renderer/features` 按业务域组织 UI 和状态管理。

## 5. 核心数据模型

### 5.1 学习计划

```ts
type StudyPlan = {
  id: string;
  title: string;
  subject: string;
  goal: string;
  userLevel: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "paused" | "completed";
  stages: PlanStage[];
};

type PlanStage = {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDays: number;
  learningObjectives: string[];
  tasks: PlanTask[];
};

type PlanTask = {
  id: string;
  dayIndex: number;
  title: string;
  type: "learn" | "practice" | "review" | "assessment" | "project";
  estimatedMinutes: number;
  objectives: string[];
  knowledgeNodeIds: string[];
  lectureId?: string;
  assessmentId?: string;
  status: "todo" | "doing" | "done" | "skipped";
};
```

### 5.2 讲义

```ts
type Lecture = {
  id: string;
  planTaskId: string;
  title: string;
  audienceLevel: string;
  prerequisites: string[];
  sections: LectureSection[];
  examples: LectureExample[];
  exercises: Exercise[];
  summary: string;
  references: ReferenceSource[];
};
```

讲义内容应尽量结构化，而不是只存一大段 Markdown。这样后续可以实现目录导航、局部重生成、练习抽取和知识节点绑定。

### 5.3 知识网络

```ts
type KnowledgeNode = {
  id: string;
  label: string;
  subject: string;
  type: "concept" | "theorem" | "method" | "skill" | "problem_type";
  description: string;
  mastery: number;
  confidence: number;
  sourceIds: string[];
  lastStudiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: "prerequisite" | "related" | "applies_to" | "derives" | "contrasts";
  weight: number;
  evidence: string;
};
```

### 5.4 学习检测

```ts
type Assessment = {
  id: string;
  planTaskId: string;
  knowledgeNodeIds: string[];
  questions: AssessmentQuestion[];
};

type AssessmentResult = {
  id: string;
  assessmentId: string;
  submittedAt: string;
  score: number;
  feedback: string;
  nodeMasteryUpdates: {
    nodeId: string;
    previousMastery: number;
    nextMastery: number;
    reason: string;
  }[];
};
```

## 6. AI 系统设计

### 6.1 LLM Provider 抽象

先实现 DeepSeek，接口设计保持中立：

```ts
interface LLMClient {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
  streamText(input: StreamTextInput): AsyncIterable<StreamTextDelta>;
}
```

DeepSeek 只作为一个实现：

```text
LLMClient
  DeepSeekClient
  FutureOpenAIClient
  FutureLocalModelClient
```

### 6.2 Agent 分工

1. Planner Agent
   - 输入：用户目标、基础、可用时间、偏好、已有知识网络。
   - 输出：结构化 `StudyPlan`。
   - 重点：拆分深度、可执行性、每日任务粒度。

2. Lecturer Agent
   - 输入：计划任务、知识节点、用户水平、参考资料。
   - 输出：结构化 `Lecture`。
   - 重点：讲义质量、例子、误区、练习。

3. Assessor Agent
   - 输入：知识点、讲义、任务目标。
   - 输出：检测题、评分标准、反馈。
   - 重点：题目难度和目标一致，能诊断真实掌握情况。

4. Graph Agent
   - 输入：计划、讲义、用户回答、AI 对话摘要。
   - 输出：知识节点和边的增删改建议。
   - 重点：保持知识网络稳定，不因一次对话产生大量噪声节点。

5. Coach Agent
   - 输入：进度、拖延情况、薄弱点、用户偏好。
   - 输出：提醒话术、复习安排、计划调整建议。
   - 重点：驱动用户主动学习，但避免过度打扰。

### 6.3 Prompt 管理

Prompt 不应散落在业务代码中，建议建立 `promptRegistry.ts`：

```text
planner.createPlan.v1
planner.revisePlan.v1
lecturer.createLecture.v1
assessor.createQuiz.v1
assessor.gradeAnswer.v1
graph.extractNodes.v1
graph.updateMastery.v1
coach.dailyNudge.v1
chat.answerWithGraph.v1
```

每个 prompt 需要记录：

1. 输入字段。
2. 输出 schema。
3. 失败重试策略。
4. 示例输入输出。
5. 版本号。

### 6.4 结构化输出策略

AI 生成以下内容时必须走 schema 校验：

1. 学习计划。
2. 每日任务。
3. 讲义章节。
4. 检测题。
5. 知识节点和边。
6. 掌握度更新。

如果校验失败：

1. 保留原始输出用于调试。
2. 让 LLM 根据错误信息修复 JSON。
3. 最多重试固定次数。
4. 仍失败则返回可理解的错误给 UI。

## 7. 工具能力规划

### 7.1 Web Search

用途：

1. 查询开放课程、教材目录、权威资料。
2. 为讲义生成补充可靠上下文。
3. 帮用户找到进一步阅读材料。

初期实现建议：

1. 先定义 `SearchTool` 接口，不急于绑定具体搜索服务。
2. 支持返回标题、摘要、URL、来源可信度。
3. 搜索结果进入 AI 前先做去重和摘要。

待商讨问题：

1. 使用哪个搜索 API。
2. 是否允许用户自定义搜索来源。
3. 是否需要缓存搜索结果。

### 7.2 PDF Read

用途：

1. 读取用户导入的教材 PDF。
2. 提取目录、章节文本、公式附近文本。
3. 将教材内容作为讲义和计划生成的参考。

初期实现建议：

1. 支持导入 PDF 文件并保存 metadata。
2. 先实现文本提取。
3. 对扫描版 PDF 暂时标记为需要 OCR。
4. 后续再加入页码引用和局部截图识别。

待商讨问题：

1. 是否优先支持中文教材 PDF。
2. 是否需要 OCR。
3. 用户导入教材的版权和本地存储策略。

### 7.3 Image Read

用途：

1. 识别教材截图、手写笔记、题目图片。
2. 将图片内容转成可问答文本。
3. 支持用户拍照上传练习题。

初期实现建议：

1. 保留 `ImageReaderTool` 接口。
2. 先允许用户上传图片，保存文件并记录来源。
3. 识图模型或 API 在实现时再确定。

### 7.4 Agent Team

用途：

1. 复杂计划生成时由多个 agent 分工。
2. 计划生成、讲义生成、检测生成、知识图谱更新互相校验。
3. 高质量内容生成时可以引入 reviewer agent。

初期实现建议：

1. 不先做复杂多进程 agent 系统。
2. 用服务层串联多个 agent 函数，形成可追踪 pipeline。
3. 等核心闭环稳定后，再引入并行 agent 或任务队列。

## 8. Electron 架构规划

### 8.1 进程职责

Renderer：

1. 页面路由。
2. 计划、讲义、知识图谱、对话 UI。
3. 表单、按钮、状态展示。
4. 不直接访问文件系统、数据库、环境变量和 API key。

Preload：

1. 暴露安全、有限的 `window.learnerAI` API。
2. 做 IPC contract 的类型桥接。

Main：

1. 管理数据库。
2. 调用 DeepSeek API。
3. 调度工具。
4. 处理系统通知。
5. 读写用户导入的文件。

### 8.2 IPC 接口示例

```ts
type LearnerAIAPI = {
  plan: {
    create(input: CreatePlanInput): Promise<StudyPlan>;
    get(planId: string): Promise<StudyPlan>;
    updateTaskStatus(input: UpdateTaskStatusInput): Promise<PlanTask>;
    revise(input: RevisePlanInput): Promise<StudyPlan>;
  };
  lecture: {
    generate(taskId: string): Promise<Lecture>;
    get(lectureId: string): Promise<Lecture>;
  };
  assessment: {
    create(taskId: string): Promise<Assessment>;
    submit(input: SubmitAssessmentInput): Promise<AssessmentResult>;
  };
  graph: {
    getGraph(subject?: string): Promise<KnowledgeGraph>;
    updateFromLearningEvent(eventId: string): Promise<KnowledgeGraphPatch>;
  };
  chat: {
    send(input: ChatInput): Promise<ChatResponse>;
  };
};
```

### 8.3 安全边界

1. Renderer 禁用 Node integration。
2. API key 只保存在 Main 进程可访问的配置中。
3. 用户导入文件只通过 Main 进程读取。
4. IPC 参数必须校验。
5. LLM 生成内容进入数据库前必须校验结构。

## 9. UI 页面规划

### 9.1 Dashboard

展示：

1. 今日学习任务。
2. 当前学习计划进度。
3. 最近薄弱知识点。
4. 下一次检测。
5. AI 给出的今日建议。

核心操作：

1. 开始今日学习。
2. 标记任务完成。
3. 进入讲义。
4. 进入检测。

### 9.2 Plan Page

展示：

1. 阶段列表。
2. 每日任务。
3. 每个任务绑定的知识点。
4. 任务状态和预计时间。

核心操作：

1. 展开阶段。
2. 调整任务日期。
3. 重新生成某一阶段。
4. 手动新增或删除任务。

### 9.3 Lecture Page

展示：

1. 讲义目录。
2. 正文。
3. 例题。
4. 练习。
5. 相关知识节点。

核心操作：

1. 生成讲义。
2. 重新生成局部章节。
3. 对某一段提问。
4. 将内容加入知识网络。

### 9.4 Assessment Page

展示：

1. 检测题。
2. 答题输入区。
3. 提交后的评分与反馈。
4. 知识点掌握度变化。

核心操作：

1. 开始检测。
2. 提交答案。
3. 查看解析。
4. 安排复习。

### 9.5 Knowledge Graph Page

展示：

1. 知识节点图。
2. 节点掌握度。
3. 节点详情。
4. 节点相关讲义、练习、对话记录。

核心操作：

1. 搜索节点。
2. 过滤节点类型。
3. 查看前置依赖。
4. 对节点提问。
5. 手动修正节点关系。

### 9.6 Chat Page

展示：

1. AI 对话。
2. 当前引用的计划、讲义、知识节点。
3. 回答后的知识网络更新建议。

核心操作：

1. 普通提问。
2. 基于当前任务提问。
3. 基于某个知识节点提问。
4. 接受或拒绝知识网络更新。

### 9.7 Settings Page

展示和配置：

1. DeepSeek API key。
2. 模型选择。
3. 每日学习时间偏好。
4. 提醒时间。
5. 数据存储位置。
6. 搜索、PDF、图片工具配置。

## 10. 数据持久化方案

初期推荐使用 SQLite：

1. Electron 本地应用适配好。
2. 单用户数据量可控。
3. 支持事务。
4. 方便迁移。

建议表：

```text
plans
plan_stages
plan_tasks
lectures
assessments
assessment_results
knowledge_nodes
knowledge_edges
learning_events
chat_sessions
chat_messages
reference_sources
settings
```

关键设计：

1. `learning_events` 记录所有学习行为，例如完成任务、生成讲义、提交检测、聊天提问。
2. 知识网络更新应尽量由事件驱动，方便回溯。
3. AI 原始响应可单独保存到 debug 表或日志文件，便于排查。

## 11. 学习闭环流程

### 11.1 创建计划

```text
用户输入目标
  -> 系统询问基础、目标、时间、偏好
  -> Planner Agent 生成计划草稿
  -> schema 校验
  -> UI 展示计划草稿
  -> 用户确认或修改
  -> 写入数据库
  -> Graph Agent 初始化知识节点和依赖关系
```

### 11.2 完成每日学习

```text
用户打开今日任务
  -> 生成或读取讲义
  -> 用户学习讲义
  -> 用户完成练习或检测
  -> Assessor Agent 评分
  -> 写入 AssessmentResult
  -> Graph Agent 更新掌握度
  -> Coach Agent 给出下一步建议
```

### 11.3 基于知识网络问答

```text
用户提问
  -> 检索相关知识节点、讲义和历史检测
  -> Chat Agent 生成回答
  -> 如果发现新知识点或误区，生成图谱更新建议
  -> 用户确认
  -> 更新知识网络
```

### 11.4 计划调整

```text
系统发现用户连续拖延、检测低分或进度超前
  -> Coach Agent 生成调整建议
  -> 用户确认
  -> Planner Agent 修改后续任务
  -> 保留修改历史
```

## 12. 阶段里程碑

### Milestone 0: 项目基础建设

目标：搭好 Electron + TypeScript 的可维护骨架。

任务：

1. 引入 TypeScript。
2. 建立 `src/main`、`src/preload`、`src/renderer`、`src/shared`。
3. 配置构建、开发启动、类型检查、基础 lint。
4. 实现安全 preload API 示例。
5. 加入基础页面路由。

验收标准：

1. 能启动 Electron 应用。
2. Renderer 通过 preload 调用 Main 的测试接口。
3. `npm run typecheck` 可运行。

### Milestone 1: 本地数据和基础 UI

目标：应用能保存和展示本地学习数据。

任务：

1. 引入 SQLite。
2. 定义核心数据类型和 schema。
3. 实现计划、任务、知识节点的 repository。
4. 完成 Dashboard、Plan Page、Knowledge Graph Page 的静态和本地数据版本。
5. 实现任务状态更新。

验收标准：

1. 创建一份 mock 学习计划并持久化。
2. 应用重启后数据仍存在。
3. 用户能标记任务完成。

### Milestone 2: DeepSeek 接入和结构化计划生成

目标：用户输入目标后，AI 能生成可执行计划。

任务：

1. 实现 `LLMClient` 和 `DeepSeekClient`。
2. 实现 API key 设置与本地保存。
3. 编写 `planner.createPlan.v1` prompt。
4. 使用 schema 校验计划输出。
5. 在 UI 中完成创建计划流程。

验收标准：

1. 用户输入「我要学习数学分析」，系统能生成多阶段、多日任务计划。
2. 每个任务包含目标、预计时间、关联知识点。
3. 计划可以保存、查看和修改状态。

### Milestone 3: 讲义生成和任务学习页

目标：计划中的每个任务都能展开为具体学习内容。

任务：

1. 实现 `LecturerAgent`。
2. 编写讲义 schema 和 prompt。
3. 实现 Lecture Page。
4. 将讲义和任务、知识节点绑定。
5. 支持局部重新生成。

验收标准：

1. 打开某个任务可以生成讲义。
2. 讲义包含动机、定义、例子、练习和小结。
3. 讲义结果可持久化。

### Milestone 4: 学习检测和掌握度更新

目标：应用能判断用户是否真正掌握知识点。

任务：

1. 实现 `AssessorAgent`。
2. 生成检测题和评分标准。
3. 实现 Assessment Page。
4. 提交答案后生成反馈。
5. 根据结果更新知识节点掌握度。

验收标准：

1. 每个任务可以生成检测题。
2. 用户提交答案后获得明确反馈。
3. 知识节点掌握度随检测结果变化。

### Milestone 5: 可交互知识网络

目标：用户能看到自己的知识结构，并基于图谱继续学习。

任务：

1. 选择知识图谱可视化库。
2. 实现节点和边的展示。
3. 支持搜索、过滤、节点详情。
4. 支持从节点跳转到讲义、任务、检测记录。
5. 支持手动修正节点和关系。

验收标准：

1. 图谱能展示计划中的知识点。
2. 节点颜色或大小能反映掌握度。
3. 点击节点能查看详情和相关学习记录。

### Milestone 6: 基于知识网络的 AI 对话

目标：AI 对话具备个人学习上下文。

任务：

1. 实现 Chat Page。
2. 实现知识节点检索。
3. 实现 `chat.answerWithGraph.v1` prompt。
4. 回答中展示引用的计划、讲义和节点。
5. 对话后生成知识网络更新建议。

验收标准：

1. 用户能围绕当前计划或节点提问。
2. AI 回答能体现用户已学和未掌握内容。
3. 用户可确认是否更新知识网络。

### Milestone 7: 提醒和主动学习驱动

目标：应用能主动推动用户学习。

任务：

1. 实现提醒设置。
2. 接入 Electron desktop notification。
3. 实现今日建议和学习 nudges。
4. 根据拖延、低分、连续完成等事件调整提醒策略。
5. 支持计划调整建议。

验收标准：

1. 到设定时间能提醒用户学习。
2. Dashboard 能显示今日建议。
3. 系统能根据学习事件给出调整建议。

### Milestone 8: Web / PDF / Image 工具增强

目标：提高计划和讲义质量。

任务：

1. 实现 Web Search tool。
2. 实现 PDF 导入和文本提取。
3. 实现图片导入接口。
4. 将外部资料作为讲义生成上下文。
5. 在讲义中展示参考来源。

验收标准：

1. 用户能导入 PDF 作为参考资料。
2. AI 生成讲义时能引用已导入资料。
3. 搜索结果或资料引用能追溯来源。

### Milestone 9: 稳定性和体验打磨

目标：把核心闭环变成稳定可用的应用。

任务：

1. 加入错误处理和重试。
2. 加入日志和调试面板。
3. 优化长任务状态，例如计划生成、讲义生成的 loading 和取消。
4. 增加测试覆盖。
5. 打磨 UI 细节。

验收标准：

1. 常见 API 错误、网络错误、schema 错误都有友好反馈。
2. 长时间 AI 任务不会让 UI 卡死。
3. 核心流程有自动化测试。

## 13. 第一版 MVP 范围

为了尽快形成可演示闭环，第一版 MVP 建议只做：

1. 单用户本地 Electron 应用。
2. DeepSeek 文本模型。
3. 手动输入学习目标。
4. AI 生成结构化学习计划。
5. AI 生成任务讲义。
6. AI 生成检测题并评分。
7. 本地知识节点和掌握度更新。
8. 简单知识网络展示。
9. 今日任务和完成状态。

暂缓：

1. 多用户账号。
2. 云同步。
3. 复杂多 Agent 并行系统。
4. OCR。
5. 完整教材级 PDF 理解。
6. 移动端。

## 14. 关键技术选择待讨论

以下问题在具体实现前建议先确认：

1. 前端框架
   - 方案 A：React + Vite + Electron，生态成熟。
   - 方案 B：Vue + Vite + Electron，开发体验也好。
   - 初步建议：React + Vite，因为图谱、状态管理和 Electron 示例更多。

2. UI 组件库
   - 是否使用现成组件库，例如 Radix、shadcn/ui、Ant Design。
   - 初步建议：如果想快做 MVP，可用 Ant Design；如果想视觉更自定义，可用 Radix + Tailwind。

3. 本地数据库
   - SQLite 是当前最稳妥选择。
   - 需要确定具体库，例如 better-sqlite3、sqlite3、drizzle。
   - 初步建议：SQLite + Drizzle，类型体验较好。

4. 知识图谱可视化
   - 可选：React Flow、Cytoscape.js、Sigma.js、D3。
   - 初步建议：先用 React Flow 或 Cytoscape.js。React Flow 对交互编辑友好，Cytoscape.js 对图分析更强。

5. DeepSeek API 使用方式
   - 需要确认使用哪个模型。
   - 需要确认是否需要流式输出。
   - 需要确认 API key 存储方式。

6. Web search
   - 需要确认搜索 API。
   - 需要确认是否允许联网搜索。
   - 需要确认搜索结果的可信度评估方式。

7. PDF / Image
   - 需要确认第一版是否只做文本 PDF。
   - 图片识别使用哪个模型或 API 需要后续确定。

8. 学习提醒策略
   - 需要确认提醒是系统通知、应用内提醒，还是两者都要。
   - 需要确认是否允许更强的主动催学机制。

## 15. 风险和应对

1. AI 输出质量不稳定
   - 应对：结构化 schema、prompt 版本管理、失败重试、人工可编辑。

2. 计划太长导致用户无法执行
   - 应对：MVP 默认生成短周期计划，例如 7 到 14 天，再逐步扩展。

3. 知识网络节点噪声过多
   - 应对：Graph Agent 只给更新建议，重要更新需要用户确认；节点合并和去重。

4. 讲义内容不够可靠
   - 应对：引入参考来源、显示来源、允许用户导入教材、保留用户反馈。

5. Renderer 和后端耦合
   - 应对：所有跨进程调用走 shared contract 和 preload API。

6. 后续工具扩展困难
   - 应对：从第一天就建立 tool registry 和 provider interface。

## 16. 近期行动清单

建议下一步按以下顺序推进：

1. 确认技术栈：React/Vue、UI 库、数据库库、图谱库。
2. 搭建 Electron + TypeScript + Vite 基础项目结构。
3. 定义 shared types 和 schema。
4. 做本地 mock 数据版 Dashboard / Plan / Graph。
5. 接 DeepSeek，完成结构化计划生成。
6. 完成讲义生成。
7. 完成检测和掌握度更新。
8. 再接入知识网络问答和提醒。

## 17. 建议优先商讨的问题

1. 第一版是否使用 React + Vite。
2. 第一版 UI 是偏快速实现还是偏精致设计。
3. 学习计划默认周期是 7 天、14 天还是可配置。
4. 知识网络第一版是否允许用户手动编辑。
5. DeepSeek API key 是否只保存在本机。
6. PDF 和 Web Search 是否进入 MVP，还是放到第二阶段。

