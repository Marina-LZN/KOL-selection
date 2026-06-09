# Daren Screening Agent Demo

本项目是“达人筛选 Agent”的本地演示版，包含 Python 后端和 React 前端。

## 功能

- 创建达人筛选任务，填写品牌、品类、活动目标、预算和调性关键词。
- 使用内置候选达人样本做本地演示。
- 后端规则侧计算商业能力分、成本效率分、履约稳定性分和综合排序。
- 调用真实大模型 API 生成调性匹配、单达人画像和营销方案。
- 展示评测指标：调性评分命中、证据引用、幻觉风险、红线漏判、NPS、成本和转化率。
- 支持 `auto / real / mock` 三种模型模式，保证面试演示时不会因为 API Key 或网络问题卡住。

## API 配置

后端使用兼容 OpenAI Chat Completions 的接口。

模型模式：

```powershell
$env:LLM_MODE="auto"
```

- `auto`：有 Key 时调用真实大模型，没有 Key 时使用标注清楚的本地模拟输出。
- `real`：强制调用真实大模型，失败就返回错误。
- `mock`：始终使用本地模拟输出，适合无网络或无 Key 的演示。

OpenAI 示例：

```powershell
$env:LLM_API_KEY="你的 OpenAI API Key"
$env:LLM_API_BASE="https://api.openai.com/v1"
$env:LLM_MODEL="gpt-4.1-mini"
```

DashScope / 通义千问兼容模式示例：

```powershell
$env:LLM_API_KEY="你的 DashScope API Key"
$env:LLM_API_BASE="https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:LLM_MODEL="qwen-plus"
```

## 启动后端

```powershell
cd C:\new\github\liuzining\daren-agent-demo\backend
uv run python app.py
```

后端地址：`http://127.0.0.1:8787`

## 启动前端

```powershell
cd C:\new\github\liuzining\daren-agent-demo\frontend
npm install
npm run dev
```

前端地址：`http://127.0.0.1:5173`

## 面试说明口径

这个 demo 的核心不是“让模型直接决定推荐谁”，而是展示上下文工程和 Prompt Engineering 的边界：

- 规则侧负责可计算、可审计、可复现的分数。
- LLM 负责调性理解、证据整合、报告生成和方案生成。
- 输出必须结构化，关键判断必须引用输入证据。
- 评测面板用来说明怎么把主观调性变成可回归指标。
