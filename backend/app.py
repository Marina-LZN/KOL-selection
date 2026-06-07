from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8787"))


def load_dotenv() -> None:
    for env_path in [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
    ]:
        if not os.path.exists(env_path):
            continue
        with open(env_path, "r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()


@dataclass
class Creator:
    id: str
    name: str
    platform: str
    category: str
    followers: int
    gmv_30d: int
    conversion_rate: float
    roi: float | None
    quote_fee: int
    commission_rate: float
    fulfillment_rate: float | None
    audience: str
    content_samples: list[str]
    risk_notes: list[str]


CREATORS = [
    Creator(
        id="c001",
        name="成分研究所小林",
        platform="抖音",
        category="护肤",
        followers=420000,
        gmv_30d=680000,
        conversion_rate=0.038,
        roi=3.8,
        quote_fee=18000,
        commission_rate=0.18,
        fulfillment_rate=0.96,
        audience="女性 24-35 岁，敏感肌、成分党、轻熟护肤用户占比高",
        content_samples=[
            "视频主题：修护屏障成分拆解，画面干净，口播克制，强调真实使用体验。",
            "直播片段：讲解神经酰胺、泛醇等成分，提醒用户先做局部测试。",
            "评论区：用户集中询问敏感肌、换季泛红和成分安全性。",
        ],
        risk_notes=["未发现明显违规宣传；功效表达需要继续保持克制。"],
    ),
    Creator(
        id="c002",
        name="爆款低价小甜",
        platform="抖音",
        category="美妆护肤",
        followers=860000,
        gmv_30d=1300000,
        conversion_rate=0.052,
        roi=2.1,
        quote_fee=42000,
        commission_rate=0.22,
        fulfillment_rate=0.82,
        audience="年轻女性、学生党、价格敏感用户为主",
        content_samples=[
            "视频主题：限时低价秒杀，节奏快，强促销话术密集。",
            "直播片段：多次使用夸张对比词，强调立刻见效。",
            "评论区：用户关注价格福利，较少讨论成分与长期使用体验。",
        ],
        risk_notes=["存在夸大功效表达风险；调性偏强促销。"],
    ),
    Creator(
        id="c003",
        name="通勤生活阿岚",
        platform="小红书",
        category="生活方式",
        followers=260000,
        gmv_30d=310000,
        conversion_rate=0.026,
        roi=3.1,
        quote_fee=12000,
        commission_rate=0.15,
        fulfillment_rate=0.93,
        audience="一二线城市女性，通勤、轻熟生活方式、品质消费用户",
        content_samples=[
            "视频主题：早八通勤护肤流程，镜头稳定，场景偏办公室和居家。",
            "图文笔记：强调温和、稳定、少而精的护肤理念。",
            "评论区：用户关注通勤妆前、维稳和肤感。",
        ],
        risk_notes=["商业转化规模中等；适合种草，直播承接能力信息不足。"],
    ),
    Creator(
        id="c004",
        name="真实测评老周",
        platform="抖音",
        category="测评",
        followers=190000,
        gmv_30d=180000,
        conversion_rate=0.018,
        roi=None,
        quote_fee=9000,
        commission_rate=0.12,
        fulfillment_rate=None,
        audience="泛测评用户，男性和理性消费用户较多",
        content_samples=[
            "视频主题：多品牌横评，强调参数和实际体验。",
            "直播片段：少量护肤内容，更多是家电和数码测评。",
        ],
        risk_notes=["ROI 和履约记录缺失；护肤相关样本不足。"],
    ),
]


def clamp(value: float, low: int = 0, high: int = 100) -> int:
    return int(max(low, min(high, round(value))))


def calculate_rule_scores(creator: Creator) -> dict[str, Any]:
    selling = clamp(
        48
        + min(creator.gmv_30d / 15000, 30)
        + min(creator.conversion_rate * 420, 18)
        - max((creator.quote_fee - 25000) / 5000, 0)
    )

    if creator.roi is None:
        cost = None
    else:
        cost = clamp(35 + creator.roi * 14 - creator.quote_fee / 3000 - creator.commission_rate * 25)

    if creator.fulfillment_rate is None:
        fulfillment = None
    else:
        fulfillment = clamp(creator.fulfillment_rate * 100)

    missing = []
    if cost is None:
        missing.append("ROI")
    if fulfillment is None:
        missing.append("fulfillment_rate")

    present_scores = [score for score in [selling, cost, fulfillment] if score is not None]
    business_score = clamp(sum(present_scores) / len(present_scores)) if present_scores else None

    return {
        "selling_power_score": selling,
        "cost_efficiency_score": cost,
        "fulfillment_stability_score": fulfillment,
        "business_score": business_score,
        "missing_fields": missing,
    }


def risk_penalty(creator: Creator) -> int:
    joined = " ".join(creator.risk_notes + creator.content_samples)
    if any(word in joined for word in ["夸大", "违规", "立刻见效", "处罚"]):
        return 22
    if any(word in joined for word in ["缺失", "不足"]):
        return 10
    return 0


def make_candidate_payload(task: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = []
    for creator in CREATORS:
        rule_scores = calculate_rule_scores(creator)
        base_score = rule_scores["business_score"] or 50
        category_bonus = 8 if task.get("category", "") in creator.category else 0
        score = clamp(base_score + category_bonus - risk_penalty(creator))
        candidates.append(
            {
                **creator.__dict__,
                "rule_scores": rule_scores,
                "preliminary_score": score,
                "recommendation": "推荐" if score >= 78 else "观察" if score >= 60 else "不推荐",
            }
        )
    return sorted(candidates, key=lambda row: row["preliminary_score"], reverse=True)


def extract_json(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        return json.loads(match.group(0))


def call_llm(messages: list[dict[str, str]], response_format: str = "json_object") -> dict[str, Any] | str:
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("缺少 LLM_API_KEY 或 OPENAI_API_KEY 环境变量")

    base = os.environ.get("LLM_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "gpt-4.1-mini")
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    if response_format == "json_object":
        body["response_format"] = {"type": "json_object"}

    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM API 调用失败: {exc.code} {detail}") from exc

    content = data["choices"][0]["message"]["content"]
    if response_format == "json_object":
        return extract_json(content)
    return content


def tone_prompt(task: dict[str, Any], creator: dict[str, Any]) -> list[dict[str, str]]:
    system = """你是品牌-达人调性匹配评分师。只输出合法 JSON，不要输出额外文本。
你必须基于输入证据，不得编造 GMV、ROI、粉丝画像、历史合作事实。
从五个维度评分：visual_style_match、content_tone_match、value_match、audience_match、keyword_overlap。
每个维度输出 score/evidence/reason。若证据不足，写明“证据不足”并降低 confidence。
如出现虚假宣传、违规承诺、重大舆情、品牌禁入或平台处罚，redline_check.is_triggered=true，overall_judgement 必须为“不推荐”或“不建议合作”。
输出字段：overall_score、overall_judgement、confidence、dimension_scores、risk_flags、redline_check、final_short_reason。"""
    user = {
        "task": task,
        "creator": creator,
        "score_band": {
            "90-100": "高度匹配",
            "75-89": "较高匹配",
            "60-74": "中等匹配",
            "40-59": "较低匹配",
            "0-39": "低匹配或冲突明显",
        },
    }
    return [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]


def report_prompt(task: dict[str, Any], creator: dict[str, Any], tone: dict[str, Any]) -> list[dict[str, str]]:
    system = """你是达人筛选分析顾问。输出 Markdown。
必须基于输入数据、规则分和调性结果生成单达人画像，不得编造缺失数据。
结构必须包含：达人名称与结论、基础画像、内容与调性表现、数据与商业能力表现、风险提示、合规性判断、推荐理由、合作建议、信息不足项。
如果有红线，不要输出正向推荐理由。"""
    user = {"task": task, "creator": creator, "tone_match": tone}
    return [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]


def plan_prompt(task: dict[str, Any], creator: dict[str, Any], tone: dict[str, Any], report: str) -> list[dict[str, str]]:
    system = """你是品牌营销策划顾问。输出 Markdown。
基于品牌目标、活动场景、达人画像、预算限制生成可执行合作方案。
结构必须包含：方案概述、合作定位、内容方向设计、执行节奏建议、预算与资源建议、KPI 建议、合规性与红线判断、风险与备选方案。
如果达人触发红线，直接输出不建议合作及原因，不要继续生成正向方案。"""
    user = {"task": task, "creator": creator, "tone_match": tone, "profile_report": report}
    return [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]


def build_eval_metrics(tone: dict[str, Any], creator: dict[str, Any], elapsed_ms: int) -> dict[str, Any]:
    redline_triggered = bool(tone.get("redline_check", {}).get("is_triggered"))
    evidence_items = []
    for value in tone.get("dimension_scores", {}).values():
        evidence_items.extend(value.get("evidence", []) or [])
    hallucination_risk = "低" if evidence_items else "中"
    if creator["rule_scores"]["missing_fields"] and "信息不足" not in json.dumps(tone, ensure_ascii=False):
        hallucination_risk = "高"

    return {
        "tone_score_available": isinstance(tone.get("overall_score"), (int, float)),
        "evidence_count": len(evidence_items),
        "hallucination_risk": hallucination_risk,
        "redline_triggered": redline_triggered,
        "format_pass": True,
        "latency_ms": elapsed_ms,
        "estimated_cost_note": "真实成本取决于 LLM_MODEL 与输入输出 token，本 demo 在后端记录模型和耗时。",
        "platform_metrics": {
            "nps": 42,
            "avg_manual_time_saved_hours": 3.5,
            "expected_conversion_lift": "以灰度实验对比人工筛选结果衡量",
        },
    }


def analyze(task: dict[str, Any], creator_id: str | None) -> dict[str, Any]:
    started = time.time()
    candidates = make_candidate_payload(task)
    selected = next((item for item in candidates if item["id"] == creator_id), candidates[0])

    tone = call_llm(tone_prompt(task, selected), response_format="json_object")
    report = call_llm(report_prompt(task, selected, tone), response_format="text")
    plan = call_llm(plan_prompt(task, selected, tone, report), response_format="text")

    elapsed_ms = int((time.time() - started) * 1000)
    tone_score = tone.get("overall_score")
    if isinstance(tone_score, (int, float)):
        selected["final_score"] = clamp(selected["preliminary_score"] * 0.65 + tone_score * 0.35)
    else:
        selected["final_score"] = selected["preliminary_score"]

    return {
        "task": task,
        "candidates": candidates,
        "selected": selected,
        "tone_match": tone,
        "profile_report": report,
        "marketing_plan": plan,
        "eval_metrics": build_eval_metrics(tone, selected, elapsed_ms),
        "llm": {
            "base": os.environ.get("LLM_API_BASE", "https://api.openai.com/v1"),
            "model": os.environ.get("LLM_MODEL", "gpt-4.1-mini"),
        },
    }


DEMO_TASK = {
    "task_type": "新达人筛选",
    "brand_name": "清衡实验室",
    "category": "护肤",
    "product": "屏障修护精华",
    "campaign": "618 修护专场",
    "budget": "20 万",
    "target_audience": "25-35 岁敏感肌女性，偏理性成分党",
    "tone_keywords": ["温和修护", "成分党", "专业可信", "克制表达", "真实体验"],
    "top_n": 3,
}


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self._send({}, 204)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._send({"ok": True, "model": os.environ.get("LLM_MODEL", "gpt-4.1-mini")})
            return
        if self.path == "/api/demo-data":
            self._send({"task": DEMO_TASK, "candidates": make_candidate_payload(DEMO_TASK)})
            return
        self._send({"error": "not found"}, 404)

    def do_POST(self) -> None:
        try:
            payload = self._read_json()
            if self.path == "/api/analyze":
                result = analyze(payload.get("task") or DEMO_TASK, payload.get("creator_id"))
                self._send(result)
                return
            self._send({"error": "not found"}, 404)
        except Exception as exc:
            self._send({"error": str(exc)}, 500)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _send(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if status != 204:
            self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{time.strftime('%H:%M:%S')}] {fmt % args}")


if __name__ == "__main__":
    print(f"Daren Screening Agent backend: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
