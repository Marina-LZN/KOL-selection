import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const fallbackTask = {
  task_type: "新达人筛选",
  brand_name: "清衡实验室",
  category: "护肤",
  product: "屏障修护精华",
  campaign: "618 修护专场",
  budget: "20 万",
  target_audience: "25-35 岁敏感肌女性，偏理性成分党",
  tone_keywords: ["温和修护", "成分党", "专业可信", "克制表达", "真实体验"],
  top_n: 3,
};

const flowSteps = [
  ["01", "任务输入", "品牌、商品、预算、调性关键词"],
  ["02", "规则侧筛选", "GMV / ROI / 报价 / 履约先算分"],
  ["03", "LLM 证据整合", "调性五维评分、引用证据、红线判断"],
  ["04", "报告与方案", "画像报告、合作建议、618 方案"],
  ["05", "评测闭环", "幻觉率、红线漏判、NPS、ROI 回流"],
];

function asText(value) {
  if (value === null || value === undefined || value === "") return "信息不足";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function formatNumber(value) {
  if (value === null || value === undefined) return "信息不足";
  return Number(value).toLocaleString("zh-CN");
}

function scoreClass(score) {
  if (score >= 80) return "score good";
  if (score >= 60) return "score mid";
  return "score low";
}

function scoreLabel(score) {
  if (score >= 80) return "高优先级";
  if (score >= 60) return "观察验证";
  return "谨慎/淘汰";
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="metric">
      <Icon size={18} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }) {
  const width = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="score-bar">
      <div className="score-row">
        <span>{label}</span>
        <b>{value ?? "缺失"}</b>
      </div>
      <div className="bar-track">
        <i style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MarkdownBlock({ content }) {
  if (!content) return <div className="empty">等待生成</div>;
  return (
    <div className="markdown">
      {content.split("\n").map((line, index) => {
        if (line.startsWith("# ")) return <h2 key={index}>{line.slice(2)}</h2>;
        if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
        if (line.startsWith("- ")) return <p className="bullet" key={index}>{line}</p>;
        if (!line.trim()) return <br key={index} />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

function LlmBadge({ config, result }) {
  const source = result?.llm?.source;
  const keyPresent = result?.llm?.key_present ?? config?.key_present;
  const mode = result?.llm?.mode ?? config?.mode ?? "auto";
  const label = source === "real" ? "真实模型" : source === "mock_fallback" ? "模型失败已回退" : keyPresent ? "待调用真实模型" : "无 Key 模拟演示";
  return (
    <div className={`llm-badge ${source === "real" ? "real" : "mock"}`}>
      <Activity size={16} />
      <span>{label}</span>
      <small>mode={mode}</small>
    </div>
  );
}

function ExplanationPanel() {
  return (
    <div className="explain">
      <h3>面试讲解口径</h3>
      <p>这个 demo 想表达的不是“让大模型决定一切”，而是把达人筛选拆成可控链路。</p>
      <p>规则侧负责可计算、可审计、可复现的分数，例如 GMV、ROI、报价、佣金、履约稳定性；LLM 负责调性理解、证据整合、报告生成和方案生成。</p>
      <p>我提升指标的动作是：统一数据口径减少人工查数时间；用硬规则过滤低质候选；用五维调性评分提升推荐说服力；把合作结果回流到规则权重和评测集里。</p>
      <p>平台级指标看 NPS、单次筛选成本、推荐采纳率、合作 ROI 和无效合作率；模型级指标看红线漏判率、幻觉率、证据引用准确率和格式通过率。</p>
    </div>
  );
}

function App() {
  const [task, setTask] = useState(fallbackTask);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("tone");

  useEffect(() => {
    fetch("/api/demo-data")
      .then((res) => res.json())
      .then((data) => {
        setTask(data.task || fallbackTask);
        setCandidates(data.candidates || []);
        setConfig(data.config || null);
        setSelectedId(data.candidates?.[0]?.id || "");
      })
      .catch((err) => {
        setError(`后端未启动或接口异常：${err.message}`);
      });
  }, []);

  function updateTask(key, value) {
    setTask((prev) => ({
      ...prev,
      [key]: key === "tone_keywords" ? value.split(/[、,，\s]+/).filter(Boolean) : value,
    }));
  }

  async function runAnalyze() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, creator_id: selectedId }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "分析失败");
      setResult(data);
      setCandidates(data.candidates || candidates);
      setActiveTab("tone");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selected = result?.selected || candidates.find((item) => item.id === selectedId);
  const tone = result?.tone_match;
  const metrics = result?.eval_metrics;
  const finalScore = selected?.final_score || selected?.preliminary_score;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <Brain size={25} />
          <div>
            <strong>达人筛选 Agent</strong>
            <span>PRD Demo · React + Python</span>
          </div>
        </div>

        <LlmBadge config={config} result={result} />

        <section className="panel task-panel">
          <div className="panel-title">
            <Sparkles size={16} />
            <span>筛选任务</span>
          </div>
          <label>品牌名称<input value={task.brand_name} onChange={(e) => updateTask("brand_name", e.target.value)} /></label>
          <label>品类<input value={task.category} onChange={(e) => updateTask("category", e.target.value)} /></label>
          <label>主推商品<input value={task.product} onChange={(e) => updateTask("product", e.target.value)} /></label>
          <label>活动场景<input value={task.campaign} onChange={(e) => updateTask("campaign", e.target.value)} /></label>
          <label>预算<input value={task.budget} onChange={(e) => updateTask("budget", e.target.value)} /></label>
          <label>目标人群<textarea value={task.target_audience} onChange={(e) => updateTask("target_audience", e.target.value)} /></label>
          <label>调性关键词<input value={asText(task.tone_keywords)} onChange={(e) => updateTask("tone_keywords", e.target.value)} /></label>

          <button className="primary" onClick={runAnalyze} disabled={loading || !selectedId}>
            {loading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
            运行完整分析
          </button>
          {error && <div className="error"><AlertTriangle size={16} />{error}</div>}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>品牌达人筛选工作台</h1>
            <p>演示重点：规则侧打分、LLM 证据整合、报告方案生成、评测闭环。</p>
          </div>
          <div className="status-stack">
            <span>后端：127.0.0.1:8787</span>
            <span>模型：{result?.llm?.model || config?.model || "gpt-4.1-mini"}</span>
          </div>
        </header>

        <section className="flow-panel">
          {flowSteps.map(([no, title, desc]) => (
            <div className="flow-step" key={no}>
              <b>{no}</b>
              <strong>{title}</strong>
              <span>{desc}</span>
            </div>
          ))}
        </section>

        <section className="summary-grid">
          <Metric icon={BarChart3} label="候选达人" value={`${candidates.length} 个`} />
          <Metric icon={ShieldCheck} label="红线漏判目标" value="0" />
          <Metric icon={Gauge} label="当前模式" value={result?.llm?.source || (config?.real_call_enabled ? "real-ready" : "mock-ready")} />
          <Metric icon={FileText} label="NPS" value={metrics?.platform_metrics?.nps ?? "灰度后统计"} />
        </section>

        <section className="main-grid">
          <div className="panel list-panel">
            <div className="panel-title">
              <Target size={16} />
              <span>候选达人排序</span>
            </div>
            <div className="candidate-list">
              {candidates.map((creator) => (
                <button
                  key={creator.id}
                  className={`candidate ${selectedId === creator.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedId(creator.id);
                    setResult(null);
                  }}
                >
                  <div>
                    <strong>{creator.name}</strong>
                    <span>{creator.platform} · {creator.category} · {Math.round(creator.followers / 10000)} 万粉</span>
                    <em>{creator.recommendation} · {scoreLabel(creator.preliminary_score)}</em>
                  </div>
                  <b className={scoreClass(creator.preliminary_score)}>{creator.preliminary_score}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="panel detail-panel">
            <div className="profile-header">
              <div>
                <h2>{selected?.name || "请选择达人"}</h2>
                <p>{selected ? `${selected.platform} · ${selected.category} · ${selected.audience}` : "内置候选样本来自 PRD 场景"}</p>
              </div>
              {selected && <b className={scoreClass(finalScore)}>{finalScore}</b>}
            </div>

            {selected && (
              <>
                <div className="evidence-strip">
                  <span>GMV 30D：{formatNumber(selected.gmv_30d)}</span>
                  <span>CVR：{(selected.conversion_rate * 100).toFixed(1)}%</span>
                  <span>ROI：{asText(selected.roi)}</span>
                  <span>报价：{formatNumber(selected.quote_fee)}</span>
                </div>
                <div className="rule-card">
                  <ScoreBar label="带货能力分" value={selected.rule_scores?.selling_power_score} />
                  <ScoreBar label="成本效率分" value={selected.rule_scores?.cost_efficiency_score} />
                  <ScoreBar label="履约稳定分" value={selected.rule_scores?.fulfillment_stability_score} />
                </div>
              </>
            )}

            {result?.llm?.warning && <div className="warning"><AlertTriangle size={16} />{result.llm.warning}</div>}

            <div className="tabs">
              <button className={activeTab === "tone" ? "active" : ""} onClick={() => setActiveTab("tone")}>调性匹配</button>
              <button className={activeTab === "report" ? "active" : ""} onClick={() => setActiveTab("report")}>画像报告</button>
              <button className={activeTab === "plan" ? "active" : ""} onClick={() => setActiveTab("plan")}>营销方案</button>
              <button className={activeTab === "eval" ? "active" : ""} onClick={() => setActiveTab("eval")}>评测指标</button>
              <button className={activeTab === "explain" ? "active" : ""} onClick={() => setActiveTab("explain")}>讲解稿</button>
            </div>

            {activeTab === "tone" && (
              <div className="tab-body">
                {!tone ? <div className="empty">点击“运行完整分析”生成五维调性评分</div> : (
                  <>
                    <div className="judgement">
                      <strong>{tone.overall_judgement}</strong>
                      <span>总分 {tone.overall_score} · 置信度 {tone.confidence}</span>
                    </div>
                    <div className="dimension-grid">
                      {Object.entries(tone.dimension_scores || {}).map(([key, value]) => (
                        <div className="dimension" key={key}>
                          <b>{key}</b>
                          <strong>{value.score}</strong>
                          <p>{value.reason}</p>
                        </div>
                      ))}
                    </div>
                    <pre>{JSON.stringify(tone.risk_flags || [], null, 2)}</pre>
                  </>
                )}
              </div>
            )}

            {activeTab === "report" && <MarkdownBlock content={result?.profile_report} />}
            {activeTab === "plan" && <MarkdownBlock content={result?.marketing_plan} />}
            {activeTab === "eval" && (
              <div className="eval-grid">
                <Metric icon={CheckCircle2} label="格式通过" value={metrics?.format_pass ? "通过" : "待测"} />
                <Metric icon={ClipboardList} label="证据数" value={metrics?.evidence_count ?? "待生成"} />
                <Metric icon={AlertTriangle} label="幻觉风险" value={metrics?.hallucination_risk ?? "待生成"} />
                <Metric icon={Activity} label="耗时" value={metrics ? `${metrics.latency_ms} ms` : "待生成"} />
                {(metrics?.quality_gates || []).map((item) => (
                  <div className="gate" key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.current}</strong>
                    <em>目标：{item.target}</em>
                  </div>
                ))}
                <div className="eval-note">
                  NPS 是净推荐值，用来衡量商务团队是否愿意推荐这个工具。业务指标还应看单次筛选成本、人工节省时长、推荐采纳率、合作转化率和 ROI。
                </div>
              </div>
            )}
            {activeTab === "explain" && <ExplanationPanel />}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
