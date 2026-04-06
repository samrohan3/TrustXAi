import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Fingerprint,
  ArrowLeftRight,
  Boxes,
  BrainCircuit,
  ShieldAlert,
  Target,
  Activity,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Database,
  Landmark,
  Sigma,
  TrendingUp,
  Gauge,
  Siren,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import SectionReveal from "@/components/shared/SectionReveal";
import VisualMetricStrip from "@/components/shared/VisualMetricStrip";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAllTransactions,
  fetchAnalystDashboardSummary,
  fetchFraudAlerts,
  fetchFraudDNA,
  subscribeFraudAlertStream,
  type BackendAlert,
  type BackendDashboardSummary,
  type BackendFraudDNA,
  type BackendTransaction,
} from "@/lib/backendApi";

const analystActions = [
  {
    title: "Investigation Workbench",
    description: "Open layering trails, entity links, and case timelines.",
    to: "/fraud-intelligence",
    icon: Fingerprint,
  },
  {
    title: "Transaction Hunt",
    description: "Filter high-risk activity and trace suspicious velocity windows.",
    to: "/transactions",
    icon: ArrowLeftRight,
  },
  {
    title: "Blockchain Trace",
    description: "Validate fraud DNA commits and chain confirmation status.",
    to: "/blockchain",
    icon: Boxes,
  },
  {
    title: "Federated Signals",
    description: "Track model convergence and privacy-preserving drift indicators.",
    to: "/federated-learning",
    icon: BrainCircuit,
  },
];

export default function AnalystDashboard() {
  const { authToken } = useAuth();
  const [transactionRows, setTransactionRows] = useState<BackendTransaction[]>([]);
  const [alertRows, setAlertRows] = useState<BackendAlert[]>([]);
  const [fraudDnaRows, setFraudDnaRows] = useState<BackendFraudDNA[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<BackendDashboardSummary | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const syncAnalystData = useCallback(async () => {
    if (!authToken) {
      setTransactionRows([]);
      setAlertRows([]);
      setFraudDnaRows([]);
      setDashboardSummary(null);
      setSyncMessage("Backend auth token unavailable. Sign in to load analyst telemetry.");
      return;
    }

    setSyncLoading(true);
    setSyncMessage("Syncing analyst dashboard from backend...");

    try {
      const [summary, transactions, alerts, dna] = await Promise.all([
        fetchAnalystDashboardSummary(),
        fetchAllTransactions({ sortBy: "timestamp", sortDir: "desc", maxRecords: 20000 }),
        fetchFraudAlerts(),
        fetchFraudDNA(),
      ]);

      setDashboardSummary(summary);
      setTransactionRows(transactions);
      setAlertRows(alerts);
      setFraudDnaRows(dna);
      setSyncMessage(
        `Loaded ${transactions.length.toLocaleString()} transactions, ${alerts.length} alerts, and ${dna.length} fraud DNA signatures.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to sync analyst dashboard.";
      setDashboardSummary(null);
      setTransactionRows([]);
      setAlertRows([]);
      setFraudDnaRows([]);
      setSyncMessage(detail);
    } finally {
      setSyncLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void syncAnalystData();
  }, [syncAnalystData]);

  useEffect(() => {
    if (!authToken) return;

    let unsubscribe = () => undefined;

    try {
      unsubscribe = subscribeFraudAlertStream({
        onAlert: (alert) => {
          setAlertRows((previous) => {
            const next = [alert, ...previous.filter((entry) => entry.id !== alert.id)];
            next.sort(
              (left, right) =>
                new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
            );
            return next.slice(0, 300);
          });
        },
        onError: (error) => {
          setSyncMessage(`Live alert stream disconnected: ${error.message}`);
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to start live alert stream.";
      setSyncMessage(detail);
    }

    return () => {
      unsubscribe();
    };
  }, [authToken]);

  const highRiskTx = transactionRows.filter((transaction) => transaction.risk_score >= 80).length;
  const blockedTx = transactionRows.filter((transaction) => transaction.status === "blocked").length;
  const activeAlerts = alertRows.length;
  const criticalAlerts = alertRows.filter((alert) => alert.severity === "critical").length;
  const avgSimilarity = Math.round(
    fraudDnaRows.reduce((sum, dna) => sum + dna.similarity, 0) / Math.max(fraudDnaRows.length, 1),
  );

  const totalVolume = transactionRows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const avgRisk = Math.round(
    transactionRows.reduce((sum, transaction) => sum + transaction.risk_score, 0) /
      Math.max(transactionRows.length, 1),
  );
  const avgModelConfidence = Math.round(
    (alertRows.reduce((sum, alert) => sum + (alert.model_confidence ?? 0), 0) /
      Math.max(alertRows.length, 1)) *
      100,
  );
  const avgRuleConfidence = Math.round(
    (alertRows.reduce((sum, alert) => sum + (alert.rule_confidence ?? 0), 0) /
      Math.max(alertRows.length, 1)) *
      100,
  );
  const modelRuleGap = avgModelConfidence - avgRuleConfidence;
  const institutionCount = new Set(transactionRows.map((transaction) => transaction.institution)).size;
  const highRiskExposure = transactionRows
    .filter((transaction) => transaction.risk_score >= 80)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const escalationRate = Math.round(
    ((criticalAlerts + alertRows.filter((alert) => alert.severity === "high").length) /
      Math.max(alertRows.length, 1)) *
      100,
  );

  const medianRisk = useMemo(() => {
    const sorted = transactionRows
      .map((transaction) => transaction.risk_score)
      .sort((left, right) => left - right);

    if (!sorted.length) return 0;

    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }, [transactionRows]);

  const highVelocitySignals = useMemo(() => {
    const now = Date.now();
    const windowStart = now - 30 * 60 * 1000;

    return transactionRows.filter(
      (transaction) =>
        new Date(transaction.timestamp).getTime() >= windowStart &&
        transaction.risk_score >= 70,
    ).length;
  }, [transactionRows]);

  const avgAlertAgeMinutes = useMemo(() => {
    if (!alertRows.length) return 0;

    const now = Date.now();
    const totalAgeMs = alertRows.reduce((sum, alert) => {
      const createdAt = new Date(alert.timestamp).getTime();
      if (Number.isNaN(createdAt)) return sum;
      return sum + Math.max(0, now - createdAt);
    }, 0);

    return Math.round(totalAgeMs / Math.max(alertRows.length, 1) / 60000);
  }, [alertRows]);

  const riskTrend = useMemo(
    () =>
      transactionRows
        .slice(0, 10)
        .reverse()
        .map((transaction, index) => ({
          label: `A${index + 1}`,
          value: transaction.risk_score,
        })),
    [transactionRows],
  );

  const alertSeverityDistribution = useMemo(() => {
    const tally = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const alert of alertRows) {
      if (alert.severity === "critical") tally.critical += 1;
      else if (alert.severity === "high") tally.high += 1;
      else if (alert.severity === "medium") tally.medium += 1;
      else tally.low += 1;
    }

    return [
      { name: "Critical", value: tally.critical, fill: "hsl(0, 72%, 51%)" },
      { name: "High", value: tally.high, fill: "hsl(38, 92%, 50%)" },
      { name: "Medium", value: tally.medium, fill: "hsl(205, 75%, 52%)" },
      { name: "Low", value: tally.low, fill: "hsl(142, 72%, 45%)" },
    ];
  }, [alertRows]);

  const riskVolumeTimeline = useMemo(() => {
    return transactionRows
      .slice(0, 16)
      .reverse()
      .map((transaction, index) => ({
        slot: `T${index + 1}`,
        risk: transaction.risk_score,
        volumeLakh: Math.max(1, Math.round(transaction.amount / 100000)),
      }));
  }, [transactionRows]);

  const alertsByHour = useMemo(() => {
    const bins = Array.from({ length: 8 }, (_, index) => {
      const start = index * 3;
      const end = start + 2;
      return {
        slot: `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`,
        total: 0,
        critical: 0,
        high: 0,
      };
    });

    for (const alert of alertRows) {
      const hour = new Date(alert.timestamp).getHours();
      if (!Number.isFinite(hour)) continue;

      const bucket = Math.max(0, Math.min(7, Math.floor(hour / 3)));
      bins[bucket].total += 1;
      if (alert.severity === "critical") {
        bins[bucket].critical += 1;
      } else if (alert.severity === "high") {
        bins[bucket].high += 1;
      }
    }

    return bins;
  }, [alertRows]);

  const riskBandDistribution = useMemo(() => {
    const bands = [
      { band: "0-39", count: 0, fill: "hsl(142, 72%, 45%)" },
      { band: "40-59", count: 0, fill: "hsl(205, 75%, 52%)" },
      { band: "60-79", count: 0, fill: "hsl(38, 92%, 50%)" },
      { band: "80-100", count: 0, fill: "hsl(0, 72%, 51%)" },
    ];

    for (const transaction of transactionRows) {
      const risk = transaction.risk_score;
      if (risk < 40) bands[0].count += 1;
      else if (risk < 60) bands[1].count += 1;
      else if (risk < 80) bands[2].count += 1;
      else bands[3].count += 1;
    }

    return bands;
  }, [transactionRows]);

  const confidenceParity = useMemo(() => {
    const order = ["critical", "high", "medium", "low"] as const;
    const tallies = new Map<string, { model: number; rules: number; count: number }>();

    for (const severity of order) {
      tallies.set(severity, { model: 0, rules: 0, count: 0 });
    }

    for (const alert of alertRows) {
      const row = tallies.get(alert.severity) ?? { model: 0, rules: 0, count: 0 };
      row.model += (alert.model_confidence ?? 0) * 100;
      row.rules += (alert.rule_confidence ?? 0) * 100;
      row.count += 1;
      tallies.set(alert.severity, row);
    }

    return order.map((severity) => {
      const row = tallies.get(severity) ?? { model: 0, rules: 0, count: 0 };
      return {
        severity: severity.toUpperCase(),
        model: Math.round(row.model / Math.max(row.count, 1)),
        rules: Math.round(row.rules / Math.max(row.count, 1)),
      };
    });
  }, [alertRows]);

  const institutionRiskMatrix = useMemo(() => {
    const map = new Map<
      string,
      {
        transactions: number;
        blocked: number;
        totalRisk: number;
        totalVolume: number;
      }
    >();

    for (const transaction of transactionRows) {
      const row = map.get(transaction.institution) ?? {
        transactions: 0,
        blocked: 0,
        totalRisk: 0,
        totalVolume: 0,
      };

      row.transactions += 1;
      row.totalRisk += transaction.risk_score;
      row.totalVolume += transaction.amount;
      if (transaction.status === "blocked") {
        row.blocked += 1;
      }

      map.set(transaction.institution, row);
    }

    return Array.from(map.entries())
      .map(([institution, row]) => ({
        institution,
        avgRisk: Math.round(row.totalRisk / Math.max(row.transactions, 1)),
        blockedRate: Math.round((row.blocked / Math.max(row.transactions, 1)) * 100),
        totalVolume: row.totalVolume,
        transactions: row.transactions,
      }))
      .sort((left, right) => right.avgRisk - left.avgRisk)
      .slice(0, 6);
  }, [transactionRows]);

  const formatAmount = (amount: number) => {
    if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `Rs ${(amount / 100000).toFixed(2)}L`;
    return `Rs ${amount.toLocaleString()}`;
  };

  const title = dashboardSummary?.title || "Analyst Dashboard";
  const summary =
    dashboardSummary?.summary ||
    "Investigation-first console for fraud detection, triage, and evidence linking";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {summary}
          </p>
          {syncMessage ? <p className="text-[11px] text-muted-foreground mt-1.5">{syncMessage}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-semibold">
            <Target className="w-3.5 h-3.5" />
            Active Investigation Mode
          </div>
          <button
            onClick={() => void syncAnalystData()}
            disabled={syncLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`} />
            {syncLoading ? "Syncing" : "Sync MongoDB"}
          </button>
        </div>
      </div>

      <SectionReveal>
        <VisualMetricStrip
          title="Analyst Hunt Pulse"
          subtitle="Operational signal stack for case triage and suspicious flow prioritization"
          variant="investigation"
          chartType="donut"
          chartPlacement="right"
          metrics={[
            {
              label: "High Risk TX",
              value: `${highRiskTx}`,
              hint: "risk >= 80",
              icon: ShieldAlert,
              tone: highRiskTx >= 3 ? "destructive" : "warning",
            },
            {
              label: "Blocked TX",
              value: `${blockedTx}`,
              hint: "automated intervention",
              icon: AlertTriangle,
              tone: blockedTx >= 2 ? "warning" : "primary",
            },
            {
              label: "Active Alerts",
              value: `${activeAlerts}`,
              hint: "pending analyst review",
              icon: Activity,
              tone: activeAlerts >= 4 ? "warning" : "primary",
            },
            {
              label: "Critical Alerts",
              value: `${criticalAlerts}`,
              hint: "priority now",
              icon: AlertTriangle,
              tone: criticalAlerts >= 1 ? "destructive" : "success",
            },
            {
              label: "DNA Similarity",
              value: `${avgSimilarity}%`,
              hint: "avg pattern confidence",
              icon: Fingerprint,
              tone: avgSimilarity >= 90 ? "success" : "warning",
            },
          ]}
          chartData={riskTrend}
          chartLabel="Risk Signal"
          badges={[
            "Role: ANALYST",
            "Scope: CASE TRIAGE",
            `Signals: ${activeAlerts} Alerts`,
          ]}
        />
      </SectionReveal>

      <SectionReveal>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Volume</p>
            <p className="text-lg font-bold mt-1">{formatAmount(totalVolume)}</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Mongo-backed transaction aggregate
            </p>
          </div>
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Risk Baseline</p>
            <p className="text-lg font-bold mt-1">{avgRisk}</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Sigma className="w-3.5 h-3.5" /> Mean risk across live feed
            </p>
          </div>
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Model Confidence</p>
            <p className="text-lg font-bold mt-1">{avgModelConfidence}%</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Alert explainability confidence
            </p>
          </div>
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Institution Spread</p>
            <p className="text-lg font-bold mt-1">{institutionCount}</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5" /> High-risk exposure {formatAmount(highRiskExposure)}
            </p>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Median Risk</p>
            <p className="text-lg font-bold mt-1">{medianRisk}</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" /> Stable centerline of incoming risk
            </p>
          </div>
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Escalation Rate</p>
            <p className="text-lg font-bold mt-1">{escalationRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Siren className="w-3.5 h-3.5" /> High + critical share of queue
            </p>
          </div>
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Model vs Rules Gap</p>
            <p className="text-lg font-bold mt-1">
              {modelRuleGap >= 0 ? "+" : ""}
              {modelRuleGap} pts
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Model {avgModelConfidence}% vs Rules {avgRuleConfidence}%
            </p>
          </div>
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">30m Velocity Signals</p>
            <p className="text-lg font-bold mt-1">{highVelocitySignals}</p>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Avg alert age {avgAlertAgeMinutes} min
            </p>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="grid xl:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-5 border border-border/70 xl:col-span-2">
            <h3 className="text-sm font-semibold mb-3">Risk and Volume Timeline</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={riskVolumeTimeline.length ? riskVolumeTimeline : [{ slot: "-", risk: 0, volumeLakh: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 14%)" />
                <XAxis dataKey="slot" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis yAxisId="left" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 8%)",
                    border: "1px solid hsl(220, 16%, 14%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line yAxisId="left" type="monotone" dataKey="risk" stroke="hsl(38, 92%, 50%)" strokeWidth={2.2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="volumeLakh" stroke="hsl(205, 75%, 52%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">Risk score and transaction amount trajectory from latest indexed MongoDB records.</p>
          </div>

          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Alert Severity Mix</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={alertSeverityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={84}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {alertSeverityDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 8%)",
                    border: "1px solid hsl(220, 16%, 14%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {alertSeverityDistribution.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
                    {entry.name}
                  </span>
                  <span className="font-semibold">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="glass rounded-xl p-5 border border-border/70">
          <h3 className="text-sm font-semibold mb-3">Institution Risk Matrix</h3>
          <div className="space-y-2">
            {institutionRiskMatrix.map((row) => (
              <div key={row.institution} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{row.institution}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      row.avgRisk >= 85
                        ? "bg-destructive/15 text-destructive"
                        : row.avgRisk >= 65
                          ? "bg-warning/15 text-warning"
                          : "bg-success/15 text-success"
                    }`}
                  >
                    Avg Risk {row.avgRisk}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-muted-foreground">
                  <p>TX: {row.transactions}</p>
                  <p>Blocked: {row.blockedRate}%</p>
                  <p>Volume: {formatAmount(row.totalVolume)}</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      row.avgRisk >= 85
                        ? "bg-destructive"
                        : row.avgRisk >= 65
                          ? "bg-warning"
                          : "bg-success"
                    }`}
                    style={{ width: `${Math.max(4, row.avgRisk)}%` }}
                  />
                </div>
              </div>
            ))}
            {!institutionRiskMatrix.length ? (
              <p className="text-xs text-muted-foreground">No institution metrics available from backend.</p>
            ) : null}
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="grid xl:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Alert Pressure by Hour</h3>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={alertsByHour}>
                <defs>
                  <linearGradient id="analystAlertTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(205, 75%, 52%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(205, 75%, 52%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 14%)" />
                <XAxis dataKey="slot" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 8%)",
                    border: "1px solid hsl(220, 16%, 14%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="total" stroke="hsl(205, 75%, 52%)" fill="url(#analystAlertTotal)" strokeWidth={2} name="Total Alerts" />
                <Line type="monotone" dataKey="critical" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} name="Critical" />
                <Line type="monotone" dataKey="high" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} name="High" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">3-hour bins from live alert timestamps.</p>
          </div>

          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Risk Band Distribution</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={riskBandDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 14%)" />
                <XAxis dataKey="band" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 8%)",
                    border: "1px solid hsl(220, 16%, 14%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskBandDistribution.map((entry) => (
                    <Cell key={entry.band} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">Spread of transaction risk buckets in analyst scope.</p>
          </div>

          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Confidence Parity by Severity</h3>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={confidenceParity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 14%)" />
                <XAxis dataKey="severity" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 8%)",
                    border: "1px solid hsl(220, 16%, 14%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="model" stroke="hsl(205, 75%, 52%)" strokeWidth={2} name="Model %" />
                <Line type="monotone" dataKey="rules" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="Rules %" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">Helps analysts compare model and rule explainability confidence.</p>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="grid md:grid-cols-2 gap-4">
          {analystActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="glass rounded-xl p-5 border border-border/70"
            >
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mb-3">
                <action.icon className="w-4.5 h-4.5 text-warning" />
              </div>
              <h3 className="text-sm font-semibold">{action.title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{action.description}</p>
              <Link
                to={action.to}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-warning hover:text-warning/90"
              >
                Open module
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="glass rounded-xl p-5 border border-border/70">
          <h3 className="text-sm font-semibold mb-3">Priority Alert Queue</h3>
          <div className="space-y-2">
            {alertRows.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium">{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground">{alert.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Risk {alert.risk_score ?? 0} | Model {((alert.model_confidence ?? 0) * 100).toFixed(0)}% | Rules {((alert.rule_confidence ?? 0) * 100).toFixed(0)}%
                  </p>
                  {alert.top_factors?.length ? (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Why flagged: {alert.top_factors.slice(0, 2).map((factor) => `${factor.factor} (${factor.score})`).join(" | ")}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    alert.severity === "critical"
                      ? "bg-destructive/15 text-destructive"
                      : alert.severity === "high"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {alert.severity.toUpperCase()}
                </span>
              </div>
            ))}
            {!alertRows.length ? (
              <p className="text-xs text-muted-foreground">No active alerts available from backend.</p>
            ) : null}
          </div>
        </div>
      </SectionReveal>
    </div>
  );
}
