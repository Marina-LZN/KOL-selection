import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Brain, FileText, Loader2, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
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
  top_n: 3
};

function asText(value) {
  if (value === null || value === undefined || value === "") return "信息不足";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function scoreClass(score) {
  if (score >= 80) return "score good";
  if (score >= 60) return "score mid";
  return "score low";
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

function App() {
  const [task, setTask] = useState(fallbackTask);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("tone");

  useEffect(() => {
    fetch("/api/demo-data")
      .then((res) => res.json())
      .then((data) => {
        setTask(data.task);
        setCandidates(data.candidates || []);
        setSelectedId(data.candidates?.[0]?.id || "");
      })
      .catch(() => {
        setCandidates([]);
      });
  }, []);

  function updateTask(key, value) {
    setTask((prev) => ({ ...prev, [key]: key === "tone_keywords" ? value.split(/[、,，\s]+/).filter(Boolean) : value }));
  }

  async function runAnalyze() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, creator_id: selectedId })
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <Brain size={24} />
          <div>
            <strong>达人筛选 Agent</strong>
            <span>本地 Demo · 真实 LLM API</span>
          </div>
        </div>

        <section className="panel">
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
            调用大模型分析
          </button>
          {error && <div className="error"><AlertTriangle size={16} />{error}</div>}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>品牌达人筛选工作台</h1>
            <p>规则侧负责分数，LLM 负责调性理解、证据整合、报告和方案。</p>
          </div>
          <div className="status-pill">
            <Activity size={16} />
            {result ? `${result.llm.model}` : "等待调用"}
          </div>
        </header>

        <section className="summary-grid">
          <Metric icon={BarChart3} label="候选达人" value={`${candidates.length} 个`} />
          <Metric icon={ShieldCheck} label="红线漏判目标" value="0" />
          <Metric icon={RefreshCw} label="回归集比例" value="70/20/10" />
          <Metric icon={FileText} label="NPS" value={metrics?.platform_metrics?.nps ?? "灰度后统计"} />
        </section>

        <section className="main-grid">
          <div className="panel list-panel">
            <div className="panel-title">
              <BarChart3 size={16} />
              <span>候选达人排序</span>
            </div>
            <div className="candidate-list">
              {candidates.map((creator) => (
                <button
                  key={creator.id}
                  className={`candidate ${selectedId === creator.id ? "active" : ""}`}
                  onClick={() => setSelectedId(creator.id)}
                >
                  <div>
                    <strong>{creator.name}</strong>
                    <span>{creator.platform} · {creator.category} · {Math.round(creator.followers / 10000)} 万粉</span>
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
              {selected && <b className={scoreClass(selected.final_score || selected.preliminary_score)}>{selected.final_score || selected.preliminary_score}</b>}
            </div>

            {selected && (
              <div className="evidence-strip">
                <span>GMV 30D：{selected.gmv_30d?.toLocaleString()}</span>
                <span>CVR：{(selected.conversion_rate * 100).toFixed(1)}%</span>
                <span>ROI：{asText(selected.roi)}</span>
                <span>报价：{selected.quote_fee?.toLocaleString()}</span>
              </div>
            )}

            <div className="tabs">
              <button className={activeTab === "tone" ? "active" : ""} onClick={() => setActiveTab("tone")}>调性匹配</button>
              <button className={activeTab === "report" ? "active" : ""} onClick={() => setActiveTab("report")}>画像报告</button>
              <button className={activeTab === "plan" ? "active" : ""} onClick={() => setActiveTab("plan")}>营销方案</button>
              <button className={activeTab === "eval" ? "active" : ""} onClick={() => setActiveTab("eval")}>评测指标</button>
            </div>

            {activeTab === "tone" && (
              <div className="tab-body">
                {!tone ? <div className="empty">点击“调用大模型分析”生成五维调性评分</div> : (
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
                <Metric icon={ShieldCheck} label="格式通过" value={metrics?.format_pass ? "通过" : "待测"} />
                <Metric icon={FileText} label="证据数" value={metrics?.evidence_count ?? "待生成"} />
                <Metric icon={AlertTriangle} label="幻觉风险" value={metrics?.hallucination_risk ?? "待生成"} />
                <Metric icon={Activity} label="耗时" value={metrics ? `${metrics.latency_ms} ms` : "待生成"} />
                <div className="eval-note">
                  平台级评测里的 NPS 是净推荐值，用来衡量商务团队是否愿意推荐这个工具。业务指标还应看单次筛选成本、人工节省时长、推荐采纳率、合作转化率和 ROI。
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

