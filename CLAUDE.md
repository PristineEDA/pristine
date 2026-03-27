# Pristine — 项目约束文件

## 项目概述

Pristine 是一款面向 ASIC 数字设计的跨平台全流程仿真调试 IDE。基于 Electron + React 前端 + C++ 核心引擎架构，覆盖 RTL 代码编辑、仿真调试、CICD 回归测试三大场景，适配 Verilator/Icarus Verilog 开源仿真器，支持 Cocotb/PyUVM 验证框架。

## 核心设计原则

1. **性能优先**：所有计算密集型功能（波形解析、X态追踪、原理图生成、FSM解析、协议解析、语法分析）必须由 C++17 实现，前端仅负责渲染与交互
2. **全本地化**：核心功能 100% 离线运行，禁止添加强制网络依赖，保障设计数据安全
3. **开源兼容**：深度适配主流开源 EDA 工具链（Verilator、Icarus Verilog、Cocotb、PyUVM）
4. **现代易用**：UI 对标 Verdi + VS Code，简约统一、低学习成本，多视图联动
5. **跨平台**：基于 Electron 实现 Windows/Linux/macOS 全平台原生支持

## 技术栈

| 层级 | 技术 | 核心职责 |
|------|------|----------|
| 前端 UI 层 | React 18 + TypeScript + Vite 6 + TailwindCSS v4 + Monaco Editor + Radix/shadcn-ui + WebGL/WebGPU | 界面渲染、用户交互、多视图联动、轻量状态管理、波形绘制 |
| Electron 宿主与 IPC 层 | Electron | 跨平台窗口管理、进程调度、安全 IPC 通信、文件系统权限管控 |
| 业务逻辑层 | Node.js | 工程管理、任务调度、状态持久化、插件管理、C++ 核心库绑定、第三方工具生命周期管理 |
| 高性能核心引擎层 | C++17 | 波形解析与渲染预处理、X态追踪、FSM解析、原理图生成、协议解析、语法分析、静态检查 |
| 第三方工具适配层 | C++/Node.js 封装 | Verilator/Icarus Verilog 仿真器适配、Cocotb/PyUVM 框架对接、FST/VCD 波形格式兼容、Slurm/LSF 集群调度 |

## 架构约束

- **五层解耦**：严格分离 UI 交互、Electron 宿主、业务调度、C++ 核心计算与第三方工具适配
- **禁止在前端 JavaScript 中实现计算密集型功能**，必须下沉到 C++ 层
- **IPC 通信三分类**：
  - 同步调用：仅用于轻量查询（<10ms），如获取配置、信号属性
  - 异步调用：用于耗时操作（波形解析、X态追踪、仿真运行），非阻塞 UI
  - 流式推送：用于实时数据（仿真日志、任务进度），延迟 <50ms
- C++ 核心引擎模块**无 UI 依赖**，可独立编译、测试、替换

## 前端编码规范

### React 模式
- 函数式组件 + Hooks（useState, useRef, useCallback, useEffect）
- Props 使用 TypeScript interface 定义
- 组件使用 default export

### 命名规则
- **PascalCase**：组件名、TypeScript 接口/类型
- **camelCase**：变量、函数、状态
- **`handle*`**：事件处理器（如 `handleTabClick`）
- **`on*`**：回调 props（如 `onFileSelect`）

### 样式
- 使用 Tailwind 工具类，**不在组件中写独立 CSS 文件**
- 色彩系统基于 oklch 格式 CSS 自定义属性（见 `src/styles/theme.css`）
- 深色主题为默认主题

### 图标
- 使用 lucide-react，尺寸 20-22px，strokeWidth 1.5

### 代码组织
- 使用 `// ─── Section Name ────` 风格的区块注释

## UI 设计规则
- **主色调**：科技蓝（#165DFF）为主交互色，深灰（#121212）为背景色
- **布局范式**：活动栏（48px 左侧固定）+ 侧面板（可折叠）+ 主内容区（可分屏）+ 底部面板 + 状态栏（24px）
- **栅格系统**：8px 基础栅格，所有间距尺寸对齐
- **字体**：UI 文本用无衬线字体，代码区用 JetBrains Mono
- **交互**：所有可点击元素有 hover/active 状态，操作有即时反馈，多视图选中状态全局同步
- **顶部工具栏**：40px 高，按钮 28×28px，间距 8px
- **侧面板**：最小 200px，最大 600px，支持拖拽调整和折叠
- **主内容区**：最小 800×600px，支持拖拽拆分和多标签页

## 安全约束

- 所有文件操作**严格限制在工程目录内**
- 所有 IPC 接口必须有参数校验，防止注入攻击
- 仿真器/第三方工具运行在**独立子进程**中，与主程序隔离
- 核心功能**禁止发起网络请求**

## 性能指标

- 10GB FST 波形文件加载 < 5s
- 百万级信号 X态追踪响应 < 1s
- 波形缩放/平移 ≥ 60fps
- Trace driver/load 性能 ≥ 2x 商用工具
- 100+ 用例并行仿真调度无延迟

## 关键数据结构参考

现有 TypeScript 接口定义见 `src/data/mockData.ts`：
- `FileNode`：文件树结构（language, expanded, error/warning）
- `Problem`：诊断信息（severity, message, code, source）
- `OutlineItem`：代码大纲（type: module|port|always|fsm|function|task）
- `AIMessage`：AI 助手消息
- `StaticCheckItem`：静态检查结果
- `Reference`：引用信息（type: definition|read|write）

新增数据结构应遵循 `src/data/mockData.ts` 中的模式，使用 TypeScript interface 定义。核心数据结构的完整规范见实施方案第五章。

## 禁止事项

- ❌ 在核心功能中添加网络依赖
- ❌ 在前端 JS 中实现波形解析、X态追踪、原理图生成等计算密集功能
- ❌ 在核心 C++ 代码中使用平台特定 API（需走平台适配层）
- ❌ 使用同步 IPC 执行耗时操作（会阻塞 UI）
- ❌ 在组件中写独立 CSS 文件（使用 Tailwind 工具类）


## 工作方式
- 在实现前先说明方法。
- 若需求有歧义、风险较高或影响较大，先澄清并等待批准，再开始写代码。
- Plan 只写方案，不写代码。
- 坚持 Spec Coding，不做 Vibe Coding。
- 优先迭代，使用 `/loop`。
- 完成后执行 `/simplify`。
- 你是统筹者，先指定一个 Claude 产出 plan。
- 基于 plan 将任务拆分后分配给不同的 Claude 并行或串行执行。
- 所有子任务应保持边界清晰、职责明确、便于独立验证。
- 完成后再指定一个 Claude 汇总结果并输出最终报告给我。

## 编码规则
- 代码中只允许使用英文。
- Spec 不依赖行号定位代码。
- 注释中不要写开发过程式说明。
- 优先用概念性描述定位代码，不用“文件路径 + 行号”。

## 拆分与范围控制
- 将任务拆分为低耦合、可独立验证的子任务，必要时使用 `/batch`。
- 重复出现 3 次的流程应沉淀为 Skill。
- 任务分配时优先控制单个 Claude 的上下文范围，避免把过多背景一次性注入到同一个上下文中。
- 只向负责该子任务的 Claude 提供完成任务所必需的最小上下文。
- 跨任务共享信息时，优先传递经过整理的结论、约束和接口，而不是完整过程性上下文。

## 质量要求
- 项目早期只保留最小必要质量标准：可运行、可验证、可回滚。
- 优先保证关键路径和高风险改动可验证。
- 处理 bug 时，先复现，再修复并验证。

## 纠错与协作
- 被纠正时，识别原因并改进做法；对重复性问题，沉淀为明确规则。
- 实现与审查分离：先完成方案或代码，再独立复核。
- 统筹者负责跟踪各 Claude 的输入、输出、依赖关系和验收结果，避免遗漏与重复劳动。
- 汇总报告应至少包含：任务目标、各子任务结果、验证结论、遗留风险、后续建议。

## 禁止事项
- 永远不要使用 `/init`。
- `CLAUDE.md` 应按项目实际需求编写，不要套用空泛模板。
- Avoid terms to describe development progress (`FIXED`, `Step`, `Week`, `Section`, `Phase`, `AC-x`, etc) in code comments or commit message or PR body.
- Avoid AI tools name (like Codex, Claude, Grok, Gemini, ...) in code comments or git commit message (including authorship) or PR body.