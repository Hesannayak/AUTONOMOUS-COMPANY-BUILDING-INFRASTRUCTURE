"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ============================================
// Version A: Fast & Magical Build Flow
// Idea (30s) -> 5 Questions (60s) -> Plan (90s) -> ONE Approve -> Build
// ============================================

type Step = "idea" | "questions" | "plan" | "building";

interface SmartQuestion {
  id: string;
  question: string;
  placeholder: string;
  type: "text" | "select";
  options?: Array<{ value: string; label: string }>;
  required: boolean;
}

interface CompanyPlan {
  id: string;
  companyName: string;
  tagline: string;
  entityType: string;
  jurisdiction: string;
  timeline: string;
  budget: { total: number; legal: number; product: number; marketing: number; operations: number };
  legal: { steps: string[]; estimatedDays: number };
  product: { stack: string; features: string[]; estimatedDays: number };
  marketing: { channels: string[]; contentPieces: number; estimatedDays: number };
  revenueProjection: { month3: string; month6: string; month12: string };
  risks: string[];
}

const API_BASE = "";

export default function BuildPage() {
  const router = useRouter();

  // Flow state
  const [step, setStep] = useState<Step>("idea");
  const [idea, setIdea] = useState("");
  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [questions, setQuestions] = useState<SmartQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<CompanyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string[]>([]);

  // Step 1: Submit idea -> get smart questions
  async function handleIdeaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim() || !founderName.trim() || !founderEmail.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}/api/companies/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      if (!resp.ok) throw new Error("Failed to generate questions");
      const data = await resp.json();
      setQuestions(data.data.questions);
      // Pre-fill defaults for select questions
      const defaults: Record<string, string> = {};
      for (const q of data.data.questions) {
        if (q.type === "select" && q.options?.length > 0) {
          defaults[q.id] = q.options[0].value;
        }
      }
      setAnswers(defaults);
      setStep("questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Submit answers -> get plan
  async function handleQuestionsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}/api/companies/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          answers,
          founderName: founderName.trim(),
          founderEmail: founderEmail.trim(),
        }),
      });

      if (!resp.ok) throw new Error("Failed to generate plan");
      const data = await resp.json();
      setPlan(data.data.plan);
      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Approve plan -> start building
  async function handleApproveAndBuild() {
    if (!plan) return;
    setLoading(true);
    setError(null);
    setStep("building");
    setBuildProgress(["Submitting build request..."]);

    try {
      const resp = await fetch(`${API_BASE}/api/companies/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          name: plan.companyName,
          budget: plan.budget.total,
          jurisdiction: plan.jurisdiction,
          entityType: plan.entityType,
          founders: [
            { name: founderName, email: founderEmail, equityPercent: 100, role: "CEO" },
          ],
          features: plan.product.features,
          targetAudience: answers["target_customer"] || "",
        }),
      });

      if (!resp.ok) throw new Error("Failed to start build");
      const data = await resp.json();
      const companyId = data.data?.companyId;

      setBuildProgress((p) => [...p, `Company created: ${plan.companyName}`, "Legal swarm activated...", "Product swarm activated...", "Growth swarm activated..."]);

      // Small delay then redirect to dashboard
      setTimeout(() => {
        if (companyId) {
          router.push(`/dashboard/${companyId}`);
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
      setStep("plan"); // Let them retry
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen py-8 sm:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-3">
            {(["idea", "questions", "plan", "building"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step === s
                      ? "bg-indigo-600 text-white"
                      : (["idea", "questions", "plan", "building"].indexOf(step) > i)
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {(["idea", "questions", "plan", "building"].indexOf(step) > i) ? "\u2713" : i + 1}
                </div>
                {i < 3 && (
                  <div className={`hidden sm:block w-16 lg:w-24 h-0.5 mx-2 ${
                    (["idea", "questions", "plan", "building"].indexOf(step) > i) ? "bg-emerald-600" : "bg-gray-800"
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Your Idea</span>
            <span>Quick Qs</span>
            <span>Your Plan</span>
            <span>Building</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Idea Input */}
        {step === "idea" && (
          <form onSubmit={handleIdeaSubmit} className="space-y-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold">
                What are you building?
              </h1>
              <p className="mt-3 text-gray-400 text-lg">
                Describe your business idea in one sentence. We handle the rest.
              </p>
            </div>

            <div>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={3}
                placeholder="e.g., SaaS platform for restaurant inventory management with automated ordering"
                className="input-field text-lg resize-none"
                autoFocus
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Your name</label>
                <input
                  type="text"
                  value={founderName}
                  onChange={(e) => setFounderName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Your email</label>
                <input
                  type="email"
                  value={founderEmail}
                  onChange={(e) => setFounderEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="input-field"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !idea.trim() || !founderName.trim() || !founderEmail.trim()}
              className="w-full btn-primary text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing your idea..." : "Next \u2192"}
            </button>
          </form>
        )}

        {/* Step 2: Smart Questions */}
        {step === "questions" && (
          <form onSubmit={handleQuestionsSubmit} className="space-y-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold">5 quick questions</h1>
              <p className="mt-3 text-gray-400">
                Help us build the perfect plan for{" "}
                <span className="text-indigo-400">&quot;{idea.slice(0, 60)}{idea.length > 60 ? "..." : ""}&quot;</span>
              </p>
            </div>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="card">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="text-indigo-400 mr-2">{i + 1}.</span>
                    {q.question}
                  </label>
                  {q.type === "select" && q.options ? (
                    <div className="grid gap-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-center px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                            answers[q.id] === opt.value
                              ? "border-indigo-500 bg-indigo-500/10"
                              : "border-gray-700 bg-gray-900 hover:border-gray-600"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.value}
                            checked={answers[q.id] === opt.value}
                            onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                            answers[q.id] === opt.value ? "border-indigo-500" : "border-gray-600"
                          }`}>
                            {answers[q.id] === opt.value && (
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            )}
                          </div>
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                      placeholder={q.placeholder}
                      className="input-field"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep("idea")}
                className="btn-secondary px-6 py-4"
              >
                \u2190 Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-primary text-lg py-4 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating your plan...
                  </span>
                ) : (
                  "Generate My Plan \u2192"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Plan Review */}
        {step === "plan" && plan && (
          <div className="space-y-8">
            <div className="text-center mb-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm mb-4">
                Plan Ready
              </div>
              <h1 className="text-3xl font-bold">{plan.companyName}</h1>
              <p className="mt-2 text-gray-400 text-lg">{plan.tagline}</p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <div className="text-2xl font-bold text-indigo-400">{plan.entityType}</div>
                <div className="text-xs text-gray-500 mt-1">Delaware</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-purple-400">{plan.timeline}</div>
                <div className="text-xs text-gray-500 mt-1">Timeline</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-emerald-400">${plan.budget.total.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">Total Budget</div>
              </div>
            </div>

            {/* Legal */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="font-semibold">Legal <span className="text-gray-500 font-normal">(Days 1-{plan.legal.estimatedDays})</span></h3>
              </div>
              <ul className="space-y-1">
                {plan.legal.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-gray-600 mt-0.5">\u2713</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Product */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <h3 className="font-semibold">Product <span className="text-gray-500 font-normal">(Days {plan.legal.estimatedDays + 1}-{plan.legal.estimatedDays + plan.product.estimatedDays})</span></h3>
              </div>
              <p className="text-sm text-gray-400 mb-2">Stack: {plan.product.stack}</p>
              <div className="flex flex-wrap gap-2">
                {plan.product.features.map((f, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Marketing */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                <h3 className="font-semibold">Marketing <span className="text-gray-500 font-normal">({plan.marketing.contentPieces} content pieces)</span></h3>
              </div>
              <ul className="space-y-1">
                {plan.marketing.channels.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-gray-600 mt-0.5">\u2713</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Revenue */}
            <div className="card">
              <h3 className="font-semibold mb-3">Revenue Projection</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-300">{plan.revenueProjection.month3}</div>
                  <div className="text-xs text-gray-500">Month 3</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-indigo-400">{plan.revenueProjection.month6}</div>
                  <div className="text-xs text-gray-500">Month 6</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-400">{plan.revenueProjection.month12}</div>
                  <div className="text-xs text-gray-500">Month 12</div>
                </div>
              </div>
            </div>

            {/* Budget breakdown */}
            <div className="card">
              <h3 className="font-semibold mb-3">Budget Allocation</h3>
              <div className="space-y-2">
                {[
                  { label: "Legal", amount: plan.budget.legal, color: "bg-blue-500" },
                  { label: "Product", amount: plan.budget.product, color: "bg-purple-500" },
                  { label: "Marketing", amount: plan.budget.marketing, color: "bg-cyan-500" },
                  { label: "Operations", amount: plan.budget.operations, color: "bg-orange-500" },
                ].map(({ label, amount, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-20">{label}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{ width: `${(amount / plan.budget.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-16 text-right">${amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setStep("questions")}
                className="btn-secondary px-6 py-4"
              >
                \u2190 Modify
              </button>
              <button
                onClick={handleApproveAndBuild}
                disabled={loading}
                className="flex-1 btn-primary text-lg py-4 disabled:opacity-50"
              >
                Approve &amp; Start Building
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Building */}
        {step === "building" && (
          <div className="text-center space-y-8">
            <div>
              <div className="inline-block w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
              <h1 className="text-3xl font-bold">Building your company...</h1>
              <p className="mt-3 text-gray-400">Our AI swarms are working. Redirecting to your dashboard.</p>
            </div>

            <div className="card text-left">
              <div className="space-y-3">
                {buildProgress.map((msg, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {i < buildProgress.length - 1 ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-emerald-400 text-xs">\u2713</span>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    <span className={i < buildProgress.length - 1 ? "text-gray-400" : "text-white"}>
                      {msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
