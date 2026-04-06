import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint, Shield, Brain, Network, Clock, AlertTriangle, Eye, X, TrendingUp, Target,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import SectionReveal from "@/components/shared/SectionReveal";
import { fraudDNAs, type FraudDNA } from "@/data/mockData";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

const catColor: Record<string, string> = {
  "Transaction Layering": "bg-destructive/10 text-destructive",
  "Money Laundering": "bg-warning/10 text-warning",
  "Cryptocurrency Fraud": "bg-accent/10 text-accent",
  "Structuring": "bg-primary/10 text-primary",
  "Identity Fraud": "bg-destructive/10 text-destructive",
};

const threatTimeline = [
  { time: "00:00", threats: 12, blocked: 12 },
  { time: "04:00", threats: 8, blocked: 8 },
  { time: "08:00", threats: 34, blocked: 33 },
  { time: "12:00", threats: 56, blocked: 54 },
  { time: "16:00", threats: 42, blocked: 41 },
  { time: "20:00", threats: 28, blocked: 27 },
  { time: "Now", threats: 19, blocked: 19 },
];

const radarData = [
  { subject: "Velocity", A: 92 },
  { subject: "Amount", A: 78 },
  { subject: "Geography", A: 65 },
  { subject: "Network", A: 88 },
  { subject: "Behavior", A: 95 },
  { subject: "Identity", A: 72 },
];

const riskFactors = [
  { label: "Velocity Stacking", score: 94, desc: "15 transactions in 2 min window" },
  { label: "Shell Entity Link", score: 97, desc: "Destination linked to known shell corp" },
  { label: "Cross-border Pattern", score: 82, desc: "Fiat→Crypto→Offshore routing" },
  { label: "Amount Structuring", score: 89, desc: "Split transactions below threshold" },
  { label: "New Account Risk", score: 76, desc: "Account age < 30 days with high volume" },
];

export default function FraudIntelligence() {
  const [selectedDNA, setSelectedDNA] = useState<FraudDNA | null>(null);
  const [activeTab, setActiveTab] = useState<"patterns" | "network" | "timeline">("patterns");

  const totalPatterns = useAnimatedCounter(fraudDNAs.length, 800);
  const avgSimilarity = useAnimatedCounter(92, 1200, 200);
  const activeThreats = useAnimatedCounter(19, 1000, 300);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fraud Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered fraud DNA patterns, threat analysis, and network mapping</p>
      </div>

      {/* Stats */}
      <SectionReveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Fingerprint, label: "Fraud DNAs", value: totalPatterns.toString(), color: "text-primary" },
            { icon: Target, label: "Avg Similarity", value: `${avgSimilarity}%`, color: "text-warning" },
            { icon: AlertTriangle, label: "Active Threats", value: activeThreats.toString(), color: "text-destructive" },
            { icon: Shield, label: "Block Rate", value: "99.2%", color: "text-success" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionReveal>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit">
        {[
          { key: "patterns" as const, label: "DNA Patterns", icon: Fingerprint },
          { key: "network" as const, label: "Threat Network", icon: Network },
          { key: "timeline" as const, label: "Timeline", icon: Clock },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "patterns" && (
          <motion.div key="patterns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Pattern list */}
              <div className="lg:col-span-2 space-y-3">
                {fraudDNAs.map((dna, i) => (
                  <motion.div key={dna.id}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="glass rounded-xl p-5 hover:border-primary/20 transition-colors duration-300 cursor-pointer"
                    onClick={() => setSelectedDNA(dna)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Fingerprint className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold">{dna.pattern}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catColor[dna.category] || "bg-muted text-muted-foreground"}`}>
                              {dna.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{dna.hash}</p>
                          <p className="text-xs text-muted-foreground mt-1">Source: {dna.source} • {new Date(dna.detectedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold font-mono text-primary">{dna.similarity}%</div>
                        <p className="text-[10px] text-muted-foreground">match</p>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }} animate={{ width: `${dna.similarity}%` }}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.6, ease: "easeOut" }} />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Risk Factors Panel */}
              <div className="space-y-4">
                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" /> AI Risk Factors
                  </h3>
                  <div className="space-y-3">
                    {riskFactors.map((f, i) => (
                      <motion.div key={f.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.08 }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{f.label}</span>
                          <span className={`text-xs font-mono font-bold ${f.score >= 90 ? "text-destructive" : f.score >= 70 ? "text-warning" : "text-success"}`}>{f.score}</span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${f.score >= 90 ? "bg-destructive" : f.score >= 70 ? "bg-warning" : "bg-success"}`}
                            initial={{ width: 0 }} animate={{ width: `${f.score}%` }}
                            transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4">Detection Radar</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(220, 16%, 14%)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar name="Score" dataKey="A" stroke="hsl(48, 96%, 53%)" fill="hsl(48, 96%, 53%)" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "network" && (
          <motion.div key="network" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Fraud Network Graph</h3>
              <div className="relative h-[400px] flex items-center justify-center">
                <svg width="100%" height="100%" viewBox="0 0 600 380" className="max-w-2xl">
                  {/* Edges */}
                  {[
                    [80, 100, 250, 50], [250, 50, 420, 80], [80, 100, 200, 250],
                    [200, 250, 420, 80], [250, 50, 200, 250], [420, 80, 500, 220],
                    [200, 250, 350, 300], [350, 300, 500, 220], [420, 80, 350, 300],
                  ].map(([x1, y1, x2, y2], i) => (
                    <motion.line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="hsl(220, 16%, 20%)" strokeWidth={1.5} strokeDasharray="4 2"
                      initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.6 }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }} />
                  ))}
                  {/* Animated data flow */}
                  {[
                    [80, 100, 250, 50], [250, 50, 420, 80], [420, 80, 500, 220],
                  ].map(([x1, y1, x2, y2], i) => (
                    <motion.circle key={`flow-${i}`} r={3} fill="hsl(48, 96%, 53%)"
                      initial={{ cx: x1, cy: y1, opacity: 0 }}
                      animate={{ cx: [x1, x2], cy: [y1, y2], opacity: [0, 1, 1, 0] }}
                      transition={{ delay: 1 + i * 0.5, duration: 2, repeat: Infinity, repeatDelay: 3 }} />
                  ))}
                  {/* Nodes */}
                  {[
                    { cx: 80, cy: 100, label: "****3421", risk: 94, type: "Source" },
                    { cx: 250, cy: 50, label: "Shell Co.", risk: 97, type: "Entity" },
                    { cx: 420, cy: 80, label: "0xF3..a9", risk: 98, type: "Crypto" },
                    { cx: 200, cy: 250, label: "Crypto Ex", risk: 78, type: "Exchange" },
                    { cx: 500, cy: 220, label: "Offshore", risk: 95, type: "Destination" },
                    { cx: 350, cy: 300, label: "Mixer", risk: 99, type: "Service" },
                  ].map((node, i) => (
                    <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.08 }}>
                      <circle cx={node.cx} cy={node.cy} r={node.risk >= 90 ? 22 : 16}
                        fill={node.risk >= 90 ? "hsl(0, 72%, 51%)" : "hsl(38, 92%, 50%)"} opacity={0.15} />
                      <circle cx={node.cx} cy={node.cy} r={node.risk >= 90 ? 10 : 7}
                        fill={node.risk >= 90 ? "hsl(0, 72%, 51%)" : "hsl(38, 92%, 50%)"} />
                      <text x={node.cx} y={node.cy - (node.risk >= 90 ? 28 : 22)} textAnchor="middle"
                        fill="hsl(220, 10%, 60%)" fontSize={9} fontFamily="JetBrains Mono, monospace">{node.type}</text>
                      <text x={node.cx} y={node.cy + (node.risk >= 90 ? 28 : 24)} textAnchor="middle"
                        fill="hsl(220, 10%, 50%)" fontSize={11} fontFamily="JetBrains Mono, monospace" fontWeight="600">{node.label}</text>
                    </motion.g>
                  ))}
                </svg>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                {[
                  { color: "bg-destructive", label: "High Risk (90+)" },
                  { color: "bg-warning", label: "Medium Risk (70-89)" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div className={`w-3 h-3 rounded-full ${l.color}`} /> {l.label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "timeline" && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-4">
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">24h Threat Timeline</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={threatTimeline}>
                  <defs>
                    <linearGradient id="gradThreats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBlk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 14%)" />
                  <XAxis dataKey="time" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(220, 18%, 8%)", border: "1px solid hsl(220, 16%, 14%)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="threats" stroke="hsl(0, 72%, 51%)" strokeWidth={2} fill="url(#gradThreats)" />
                  <Area type="monotone" dataKey="blocked" stroke="hsl(142, 72%, 45%)" strokeWidth={2} fill="url(#gradBlk)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Recent threat events */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Recent Threat Events</h3>
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                {[
                  { time: "14:24", event: "Velocity Stacking detected — 15 txns in 2 min", severity: "critical" },
                  { time: "14:18", event: "Crypto wash trading pattern identified via SBI", severity: "high" },
                  { time: "14:10", event: "Shell company transfer flagged — zero history entity", severity: "critical" },
                  { time: "13:58", event: "Bulk transfer to multiple recipients — smurfing alert", severity: "high" },
                  { time: "13:45", event: "Cross-border threshold approaching — SWIFT monitor", severity: "medium" },
                  { time: "13:30", event: "New account with high-volume activity detected", severity: "medium" },
                ].map((e, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    className="relative">
                    <div className={`absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-background ${
                      e.severity === "critical" ? "bg-destructive" : e.severity === "high" ? "bg-warning" : "bg-accent"
                    }`} />
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">{e.time}</span>
                      <div>
                        <p className="text-xs">{e.event}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                          e.severity === "critical" ? "bg-destructive/10 text-destructive" :
                          e.severity === "high" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"
                        }`}>{e.severity}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DNA Detail Modal */}
      <AnimatePresence>
        {selectedDNA && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50" onClick={() => setSelectedDNA(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[500px] z-50 bg-card border border-border rounded-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold">{selectedDNA.pattern}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{selectedDNA.hash}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDNA(null)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3">
                {[
                  ["Category", selectedDNA.category],
                  ["Similarity", `${selectedDNA.similarity}%`],
                  ["Source", selectedDNA.source],
                  ["Detected", new Date(selectedDNA.detectedAt).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono font-medium">{v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 rounded-xl bg-secondary/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">AI Insight: </span>
                  This fraud DNA pattern shows {selectedDNA.similarity}% match with known {selectedDNA.category.toLowerCase()} signatures.
                  Cross-institutional correlation confirms multi-hop transaction layering involving {selectedDNA.source.includes("Multi") ? "3+ institutions" : "the monitored institution"}.
                  Recommend escalation to compliance team for SAR filing.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
