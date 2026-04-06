import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Eye,
  ArrowRight,
  ArrowLeftRight,
  Boxes,
  CheckCircle2,
  Building2,
  Activity,
  RotateCcw,
} from "lucide-react";
import SectionReveal from "@/components/shared/SectionReveal";
import VisualMetricStrip from "@/components/shared/VisualMetricStrip";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAllTransactions,
  fetchBlockchainEntries,
  fetchBlockchainMetrics,
  fetchViewerDashboardSummary,
  type BackendBlockchainEntry,
  type BackendBlockchainMetrics,
  type BackendDashboardSummary,
  type BackendTransaction,
} from "@/lib/backendApi";

const quickViews = [
  {
    title: "Transaction Activity",
    description: "Browse live and historical transaction stream summaries.",
    to: "/transactions",
    icon: ArrowLeftRight,
  },
  {
    title: "Blockchain Evidence",
    description: "Inspect immutable fraud ledger updates and confirmations.",
    to: "/blockchain",
    icon: Boxes,
  },
];

export default function ViewerDashboard() {
  const { authToken } = useAuth();
  const [transactionRows, setTransactionRows] = useState<BackendTransaction[]>([]);
  const [blockchainRows, setBlockchainRows] = useState<BackendBlockchainEntry[]>([]);
  const [blockchainMetrics, setBlockchainMetrics] = useState<BackendBlockchainMetrics | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<BackendDashboardSummary | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const syncViewerData = useCallback(async () => {
    if (!authToken) {
      setTransactionRows([]);
      setBlockchainRows([]);
      setBlockchainMetrics(null);
      setDashboardSummary(null);
      setSyncMessage("Backend auth token unavailable. Sign in to load live viewer telemetry.");
      return;
    }

    setSyncLoading(true);
    setSyncMessage("Syncing viewer dashboard from backend...");

    try {
      const [summary, transactions, blockchainEntries, metrics] = await Promise.all([
        fetchViewerDashboardSummary(),
        fetchAllTransactions({ sortBy: "timestamp", sortDir: "desc", maxRecords: 20000 }),
        fetchBlockchainEntries(),
        fetchBlockchainMetrics(),
      ]);

      setDashboardSummary(summary);
      setTransactionRows(transactions);
      setBlockchainRows(blockchainEntries);
      setBlockchainMetrics(metrics);
      setSyncMessage(
        `Loaded ${transactions.length.toLocaleString()} transactions and ${blockchainEntries.length} chain entries from backend.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to sync viewer dashboard.";
      setDashboardSummary(null);
      setTransactionRows([]);
      setBlockchainRows([]);
      setBlockchainMetrics(null);
      setSyncMessage(detail);
    } finally {
      setSyncLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void syncViewerData();
  }, [syncViewerData]);

  const approvedTx = transactionRows.filter((transaction) => transaction.status === "approved").length;
  const approvedRate = Math.round((approvedTx / Math.max(transactionRows.length, 1)) * 100);
  const confirmedOnChain =
    blockchainMetrics?.confirmed_count ??
    blockchainRows.filter((entry) => entry.status === "confirmed").length;
  const chainRate =
    blockchainMetrics?.confirmation_rate ??
    Math.round((confirmedOnChain / Math.max(blockchainRows.length, 1)) * 100);
  const trackedInstitutions = new Set(transactionRows.map((transaction) => transaction.institution)).size;
  const avgRisk = Math.round(
    transactionRows.reduce((sum, transaction) => sum + transaction.risk_score, 0) /
      Math.max(transactionRows.length, 1),
  );

  const confidenceTrend = useMemo(
    () =>
      transactionRows
        .slice(0, 10)
        .reverse()
        .map((transaction, index) => ({
          label: `V${index + 1}`,
          value: Math.max(0, 100 - transaction.risk_score),
        })),
    [transactionRows],
  );

  const title = dashboardSummary?.title || "Viewer Dashboard";
  const summary =
    dashboardSummary?.summary ||
    "Read-only operational snapshot for cross-bank fraud monitoring";

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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
            <Eye className="w-3.5 h-3.5" />
            Read-Only Mode
          </div>
          <button
            onClick={() => void syncViewerData()}
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
          title="Executive Visibility Pulse"
          subtitle="Portfolio health indicators designed for observer and stakeholder monitoring"
          variant="landing"
          chartType="radar"
          chartPlacement="left"
          metrics={[
            {
              label: "Approved Rate",
              value: `${approvedRate}%`,
              hint: "transaction approval ratio",
              icon: CheckCircle2,
              tone: approvedRate >= 70 ? "success" : "warning",
            },
            {
              label: "Chain Confirmation",
              value: `${chainRate}%`,
              hint: "on-chain event finality",
              icon: Boxes,
              tone: chainRate >= 80 ? "success" : "warning",
            },
            {
              label: "Institutions Tracked",
              value: `${trackedInstitutions}`,
              hint: "active sources in feed",
              icon: Building2,
              tone: "accent",
            },
            {
              label: "Average Risk",
              value: `${avgRisk}`,
              hint: "current transaction baseline",
              icon: Activity,
              tone: avgRisk >= 60 ? "warning" : "primary",
            },
          ]}
          chartData={confidenceTrend}
          chartLabel="Confidence Trend"
          badges={[
            "Access: VIEW ONLY",
            "Data: LIVE SNAPSHOT",
            `Chain Confirmed: ${confirmedOnChain}`,
          ]}
        />
      </SectionReveal>

      <SectionReveal>
        <div className="grid md:grid-cols-2 gap-4">
          {quickViews.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="glass rounded-xl p-5 border border-border/70"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                <item.icon className="w-4.5 h-4.5 text-accent" />
              </div>
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.description}</p>
              <Link
                to={item.to}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/90"
              >
                Open view
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="glass rounded-xl p-5 border border-border/70">
          <h3 className="text-sm font-semibold mb-3">Latest Read-Only Highlights</h3>
          <div className="space-y-2">
            {transactionRows.slice(0, 4).map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium">{transaction.id}</p>
                  <p className="text-[11px] text-muted-foreground">{transaction.from_account} to {transaction.to_account}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">Rs {transaction.amount.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Risk {transaction.risk_score}</p>
                </div>
              </div>
            ))}
            {!transactionRows.length ? (
              <p className="text-xs text-muted-foreground">No transaction highlights available from backend.</p>
            ) : null}
          </div>
        </div>
      </SectionReveal>
    </div>
  );
}
