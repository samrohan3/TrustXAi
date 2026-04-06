import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Archive,
  BarChart3,
  CheckCircle2,
  FileCheck2,
  FileDown,
  FileSearch,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SectionReveal from "@/components/shared/SectionReveal";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadRegulatorExportBundle,
  downloadSignedInvestigationReportCsv,
  downloadSignedInvestigationReportPdf,
  fetchAllTransactions,
  fetchFraudAlerts,
  fetchInvestigationAuditLogs,
  fetchInvestigationCaseOptions,
  verifyInvestigationAuditLogs,
  type BackendAlert,
  type BackendInvestigationCaseOption,
  type BackendTransaction,
  type SignedExportReceipt,
} from "@/lib/backendApi";

type BusyAction = "sync" | "pdf" | "csv" | "bundle" | "audit" | "chart-pdf" | null;

const shortHash = (value: string | null | undefined) => {
  if (!value) return "n/a";
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-10)}`;
};

const formatAmount = (amount: number) => {
  if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `Rs ${(amount / 100000).toFixed(2)}L`;
  return `Rs ${amount.toLocaleString()}`;
};

const severityColorMap: Record<string, string> = {
  critical: "hsl(0, 72%, 51%)",
  high: "hsl(38, 92%, 50%)",
  medium: "hsl(205, 75%, 52%)",
  low: "hsl(142, 72%, 45%)",
};

export default function Reports() {
  const { authToken } = useAuth();

  const [caseOptions, setCaseOptions] = useState<BackendInvestigationCaseOption[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [transactionRows, setTransactionRows] = useState<BackendTransaction[]>([]);
  const [alertRows, setAlertRows] = useState<BackendAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [lastReceipt, setLastReceipt] = useState<SignedExportReceipt | null>(null);
  const [auditValid, setAuditValid] = useState<boolean | null>(null);
  const [auditReason, setAuditReason] = useState<string | null>(null);
  const [auditLogCount, setAuditLogCount] = useState<number | null>(null);
  const [auditLatestHash, setAuditLatestHash] = useState<string | null>(null);

  const syncCaseOptions = useCallback(async () => {
    if (!authToken) {
      setCaseOptions([]);
      setSelectedCaseIds([]);
      setTransactionRows([]);
      setAlertRows([]);
      setSyncMessage("Backend auth token unavailable. Sign in to load report cases.");
      return;
    }

    setBusyAction("sync");
    setSyncMessage("Loading investigation cases for report exports...");

    try {
      const [options, transactions, alerts] = await Promise.all([
        fetchInvestigationCaseOptions(),
        fetchAllTransactions({ sortBy: "timestamp", sortDir: "desc", maxRecords: 20000 }),
        fetchFraudAlerts(),
      ]);

      setCaseOptions(options);
      setTransactionRows(transactions);
      setAlertRows(alerts);
      setSelectedCaseIds((previous) =>
        previous.filter((caseId) => options.some((entry) => entry.case_id === caseId)),
      );
      setSyncMessage(
        `Loaded ${options.length} cases, ${transactions.length.toLocaleString()} transactions, and ${alerts.length} alerts for chart-ready reporting.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to load investigation cases.";
      setCaseOptions([]);
      setSelectedCaseIds([]);
      setTransactionRows([]);
      setAlertRows([]);
      setSyncMessage(detail);
    } finally {
      setBusyAction(null);
    }
  }, [authToken]);

  useEffect(() => {
    void syncCaseOptions();
  }, [syncCaseOptions]);

  const loadAuditTelemetry = useCallback(async (caseIds: string[]) => {
    const [verification, logs] = await Promise.all([
      verifyInvestigationAuditLogs(caseIds),
      fetchInvestigationAuditLogs(caseIds, 500),
    ]);

    setAuditValid(verification.valid);
    setAuditReason(verification.reason);
    setAuditLatestHash(verification.latest_hash);
    setAuditLogCount(logs.length);

    return verification;
  }, []);

  const refreshAuditTelemetry = useCallback(async () => {
    if (!selectedCaseIds.length) {
      setAuditValid(null);
      setAuditReason("Select one or more cases to verify immutable logs.");
      setAuditLogCount(null);
      setAuditLatestHash(null);
      return;
    }

    setBusyAction("audit");
    setSyncMessage("Verifying immutable activity logs...");

    try {
      const verification = await loadAuditTelemetry(selectedCaseIds);
      setSyncMessage(
        `Audit chain ${verification.valid ? "verified" : "failed"} (${verification.checked_records} checked records).`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Audit verification failed.";
      setAuditValid(false);
      setAuditReason(detail);
      setAuditLogCount(null);
      setAuditLatestHash(null);
      setSyncMessage(detail);
    } finally {
      setBusyAction(null);
    }
  }, [loadAuditTelemetry, selectedCaseIds]);

  const runExport = useCallback(
    async (kind: "pdf" | "csv" | "bundle") => {
      if (!selectedCaseIds.length) return;

      setBusyAction(kind);
      setSyncMessage(
        kind === "bundle"
          ? "Generating regulator-ready signed bundle..."
          : `Generating signed ${kind.toUpperCase()} report...`,
      );

      try {
        let receipt: SignedExportReceipt;

        if (kind === "pdf") {
          receipt = await downloadSignedInvestigationReportPdf(selectedCaseIds);
        } else if (kind === "csv") {
          receipt = await downloadSignedInvestigationReportCsv(selectedCaseIds);
        } else {
          receipt = await downloadRegulatorExportBundle(selectedCaseIds);
        }

        setLastReceipt(receipt);

        try {
          await loadAuditTelemetry(selectedCaseIds);
          setSyncMessage(`Downloaded ${receipt.filename} with signature receipt metadata.`);
        } catch {
          setSyncMessage(`Downloaded ${receipt.filename}. Audit verification needs retry.`);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Signed export failed.";
        setSyncMessage(detail);
      } finally {
        setBusyAction(null);
      }
    },
    [loadAuditTelemetry, selectedCaseIds],
  );

  const filteredCaseOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return caseOptions;

    return caseOptions.filter((entry) => {
      return (
        entry.case_id.toLowerCase().includes(query) ||
        entry.title.toLowerCase().includes(query) ||
        entry.lead_agency.toLowerCase().includes(query)
      );
    });
  }, [caseOptions, searchQuery]);

  const selectedCaseSet = useMemo(() => new Set(selectedCaseIds), [selectedCaseIds]);

  const selectedCaseDetails = useMemo(
    () => caseOptions.filter((entry) => selectedCaseSet.has(entry.case_id)),
    [caseOptions, selectedCaseSet],
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
      { name: "Critical", value: tally.critical, fill: severityColorMap.critical },
      { name: "High", value: tally.high, fill: severityColorMap.high },
      { name: "Medium", value: tally.medium, fill: severityColorMap.medium },
      { name: "Low", value: tally.low, fill: severityColorMap.low },
    ];
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

  const transactionRiskTrend = useMemo(() => {
    return transactionRows
      .slice(0, 14)
      .reverse()
      .map((transaction, index) => ({
        label: `P${index + 1}`,
        risk: transaction.risk_score,
        amountLakh: Math.max(1, Math.round(transaction.amount / 100000)),
      }));
  }, [transactionRows]);

  const institutionExposure = useMemo(() => {
    const map = new Map<string, { txCount: number; totalVolume: number; totalRisk: number }>();

    for (const transaction of transactionRows) {
      const row = map.get(transaction.institution) ?? {
        txCount: 0,
        totalVolume: 0,
        totalRisk: 0,
      };

      row.txCount += 1;
      row.totalVolume += transaction.amount;
      row.totalRisk += transaction.risk_score;
      map.set(transaction.institution, row);
    }

    return Array.from(map.entries())
      .map(([institution, row]) => ({
        institution,
        txCount: row.txCount,
        avgRisk: Math.round(row.totalRisk / Math.max(row.txCount, 1)),
        totalVolume: row.totalVolume,
      }))
      .sort((left, right) => right.avgRisk - left.avgRisk)
      .slice(0, 6);
  }, [transactionRows]);

  const reportTotalVolume = transactionRows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const reportHighRiskCount = transactionRows.filter((transaction) => transaction.risk_score >= 80).length;

  const canExportChartsPdf =
    busyAction === null && (transactionRows.length > 0 || alertRows.length > 0);

  const downloadChartsPdf = useCallback(async () => {
    if (!canExportChartsPdf) {
      setSyncMessage("Sync report analytics data before exporting chart PDF.");
      return;
    }

    setBusyAction("chart-pdf");
    setSyncMessage("Generating analyst PDF with chart visuals...");

    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = 46;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text("TrustXAi Analyst Visual Report", margin, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 14;
      doc.text(
        `Cases: ${selectedCaseIds.length ? selectedCaseIds.join(", ") : "No explicit selection"}`,
        margin,
        y,
        { maxWidth: pageWidth - margin * 2 },
      );
      y += 20;

      const statW = (pageWidth - margin * 2 - 16) / 3;
      const stats = [
        { label: "Total Volume", value: formatAmount(reportTotalVolume) },
        { label: "High Risk TX", value: `${reportHighRiskCount}` },
        { label: "Active Alerts", value: `${alertRows.length}` },
      ];

      stats.forEach((stat, index) => {
        const x = margin + index * (statW + 8);
        doc.setDrawColor(80, 80, 80);
        doc.roundedRect(x, y, statW, 44, 4, 4);
        doc.setFontSize(9);
        doc.text(stat.label, x + 8, y + 14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(stat.value, x + 8, y + 31);
        doc.setFont("helvetica", "normal");
      });

      y += 62;

      const chartTop = y;
      const chartHeight = 178;
      const halfWidth = (pageWidth - margin * 2 - 14) / 2;

      const drawBarSet = (
        title: string,
        x: number,
        values: Array<{ name: string; value: number; color: [number, number, number] }>,
      ) => {
        doc.setDrawColor(95, 95, 95);
        doc.roundedRect(x, chartTop, halfWidth, chartHeight, 4, 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(title, x + 8, chartTop + 14);
        doc.setFont("helvetica", "normal");

        const axisLeft = x + 24;
        const axisBottom = chartTop + chartHeight - 24;
        const axisRight = x + halfWidth - 12;
        const axisTop = chartTop + 28;
        doc.setDrawColor(120, 120, 120);
        doc.line(axisLeft, axisTop, axisLeft, axisBottom);
        doc.line(axisLeft, axisBottom, axisRight, axisBottom);

        const maxValue = Math.max(1, ...values.map((entry) => entry.value));
        const slotWidth = (axisRight - axisLeft) / Math.max(values.length, 1);
        const barWidth = Math.max(16, slotWidth * 0.52);

        values.forEach((entry, index) => {
          const barHeight = ((axisBottom - axisTop - 8) * entry.value) / maxValue;
          const barX = axisLeft + index * slotWidth + (slotWidth - barWidth) / 2;
          const barY = axisBottom - barHeight;

          doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
          doc.rect(barX, barY, barWidth, barHeight, "F");

          doc.setFontSize(8);
          doc.setTextColor(220, 220, 220);
          doc.text(String(entry.value), barX + 2, barY - 3);
          doc.text(entry.name, barX, axisBottom + 12, { maxWidth: barWidth + 2 });
          doc.setTextColor(0, 0, 0);
        });
      };

      drawBarSet(
        "Alert Severity Distribution",
        margin,
        alertSeverityDistribution.map((entry) => ({
          name: entry.name,
          value: entry.value,
          color:
            entry.name === "Critical"
              ? [214, 40, 40]
              : entry.name === "High"
                ? [245, 158, 11]
                : entry.name === "Medium"
                  ? [37, 99, 235]
                  : [22, 163, 74],
        })),
      );

      drawBarSet(
        "Risk Band Spread",
        margin + halfWidth + 14,
        riskBandDistribution.map((entry, index) => ({
          name: entry.band,
          value: entry.count,
          color:
            index === 0
              ? [22, 163, 74]
              : index === 1
                ? [37, 99, 235]
                : index === 2
                  ? [245, 158, 11]
                  : [214, 40, 40],
        })),
      );

      y = chartTop + chartHeight + 16;

      const trendHeight = 190;
      doc.setDrawColor(95, 95, 95);
      doc.roundedRect(margin, y, pageWidth - margin * 2, trendHeight, 4, 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Transaction Risk + Volume Trend", margin + 8, y + 14);
      doc.setFont("helvetica", "normal");

      const plotLeft = margin + 24;
      const plotRight = pageWidth - margin - 16;
      const plotTop = y + 30;
      const plotBottom = y + trendHeight - 24;
      const plotWidth = plotRight - plotLeft;
      const plotHeight = plotBottom - plotTop;

      doc.setDrawColor(120, 120, 120);
      doc.line(plotLeft, plotTop, plotLeft, plotBottom);
      doc.line(plotLeft, plotBottom, plotRight, plotBottom);

      const trendSeries = transactionRiskTrend.length
        ? transactionRiskTrend
        : [{ label: "P0", risk: 0, amountLakh: 0 }];

      const riskPoints = trendSeries.map((entry, index) => {
        const x =
          plotLeft +
          (plotWidth * index) /
            Math.max(trendSeries.length - 1, 1);
        const yPos = plotBottom - (plotHeight * Math.max(0, Math.min(100, entry.risk))) / 100;
        return { x, y: yPos };
      });

      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1.8);
      for (let index = 1; index < riskPoints.length; index += 1) {
        doc.line(riskPoints[index - 1].x, riskPoints[index - 1].y, riskPoints[index].x, riskPoints[index].y);
      }
      riskPoints.forEach((point) => {
        doc.setFillColor(37, 99, 235);
        doc.circle(point.x, point.y, 1.8, "F");
      });

      const maxVolume = Math.max(1, ...trendSeries.map((entry) => entry.amountLakh));
      const volumePoints = trendSeries.map((entry, index) => {
        const x =
          plotLeft +
          (plotWidth * index) /
            Math.max(trendSeries.length - 1, 1);
        const yPos = plotBottom - (plotHeight * entry.amountLakh) / maxVolume;
        return { x, y: yPos };
      });

      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(1.4);
      for (let index = 1; index < volumePoints.length; index += 1) {
        doc.line(
          volumePoints[index - 1].x,
          volumePoints[index - 1].y,
          volumePoints[index].x,
          volumePoints[index].y,
        );
      }

      doc.setFillColor(37, 99, 235);
      doc.rect(plotRight - 140, y + 12, 8, 8, "F");
      doc.setFillColor(245, 158, 11);
      doc.rect(plotRight - 70, y + 12, 8, 8, "F");
      doc.setFontSize(8);
      doc.text("Risk", plotRight - 128, y + 19);
      doc.text("Volume", plotRight - 58, y + 19);

      y += trendHeight + 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Top Risk Institutions", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      institutionExposure.slice(0, 5).forEach((row, index) => {
        const text = `${index + 1}. ${row.institution} | Avg Risk ${row.avgRisk} | Volume ${formatAmount(row.totalVolume)}`;
        doc.text(text, margin, y + 14 + index * 12, { maxWidth: pageWidth - margin * 2 });
      });

      const filename = `trustxai-analyst-visual-report-${Date.now()}.pdf`;
      doc.save(filename);
      setSyncMessage(`Downloaded ${filename} with embedded charts.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to generate chart PDF.";
      setSyncMessage(detail);
    } finally {
      setBusyAction(null);
    }
  }, [
    alertRows.length,
    alertSeverityDistribution,
    canExportChartsPdf,
    institutionExposure,
    reportHighRiskCount,
    reportTotalVolume,
    riskBandDistribution,
    selectedCaseIds,
    transactionRiskTrend,
  ]);

  const canRunActions = selectedCaseIds.length > 0 && busyAction === null;

  const toggleCase = (caseId: string) => {
    setSelectedCaseIds((previous) => {
      if (previous.includes(caseId)) {
        return previous.filter((entry) => entry !== caseId);
      }
      return [...previous, caseId];
    });
  };

  const selectAllVisible = () => {
    const visibleIds = filteredCaseOptions.map((entry) => entry.case_id);
    if (!visibleIds.length) return;
    setSelectedCaseIds((previous) => Array.from(new Set([...previous, ...visibleIds])));
  };

  const clearSelection = () => {
    setSelectedCaseIds([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Compliance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed export center for regulator handoff and immutable audit verification
          </p>
          {syncMessage ? <p className="mt-1.5 text-[11px] text-muted-foreground">{syncMessage}</p> : null}
        </div>
        <button
          onClick={() => void syncCaseOptions()}
          disabled={busyAction !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${busyAction === "sync" ? "animate-spin" : ""}`} />
          {busyAction === "sync" ? "Syncing" : "Refresh Cases"}
        </button>
      </div>

      <SectionReveal>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cases Loaded</p>
            <p className="mt-2 font-mono text-2xl font-bold">{caseOptions.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected Cases</p>
            <p className="mt-2 font-mono text-2xl font-bold text-primary">{selectedCaseIds.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Audit Records</p>
            <p className="mt-2 font-mono text-2xl font-bold">{auditLogCount ?? 0}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alerts Loaded</p>
            <p className="mt-2 font-mono text-2xl font-bold">{alertRows.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">TX Loaded</p>
            <p className="mt-2 font-mono text-2xl font-bold">{transactionRows.length.toLocaleString()}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">High Risk TX</p>
            <p className="mt-2 font-mono text-2xl font-bold text-destructive">{reportHighRiskCount}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Audit Status</p>
            <p
              className={`mt-2 font-mono text-2xl font-bold ${
                auditValid === null ? "text-muted-foreground" : auditValid ? "text-success" : "text-destructive"
              }`}
            >
              {auditValid === null ? "N/A" : auditValid ? "VALID" : "FAILED"}
            </p>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="glass rounded-xl p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filter cases by ID, title, or agency"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllVisible}
                disabled={!filteredCaseOptions.length}
                className="rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                Select Visible
              </button>
              <button
                onClick={clearSelection}
                disabled={!selectedCaseIds.length}
                className="rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {filteredCaseOptions.map((entry) => {
              const checked = selectedCaseSet.has(entry.case_id);
              return (
                <label
                  key={entry.case_id}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                    checked ? "border-primary/60 bg-primary/5" : "border-border bg-secondary/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCase(entry.case_id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-semibold">{entry.case_id}</p>
                    <p className="text-[11px] text-muted-foreground">{entry.title}</p>
                    <p className="text-[10px] text-muted-foreground">{entry.lead_agency}</p>
                  </div>
                </label>
              );
            })}
            {!filteredCaseOptions.length ? (
              <p className="rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
                No cases match your filter.
              </p>
            ) : null}
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Alert Severity Distribution</h3>
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

          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Transaction Risk Bands</h3>
            <ResponsiveContainer width="100%" height={220}>
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
            <p className="text-[11px] text-muted-foreground mt-2">
              Distribution of risk intensity from synchronized transaction feed.
            </p>
          </div>

          <div className="glass rounded-xl p-5 border border-border/70">
            <h3 className="text-sm font-semibold mb-3">Risk + Volume Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={
                  transactionRiskTrend.length
                    ? transactionRiskTrend
                    : [{ label: "P0", risk: 0, amountLakh: 0 }]
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 14%)" />
                <XAxis dataKey="label" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis yAxisId="left" domain={[0, 100]} stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(220, 10%, 50%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 8%)",
                    border: "1px solid hsl(220, 16%, 14%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="risk" stroke="hsl(205, 75%, 52%)" strokeWidth={2} name="Risk" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="amountLakh" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="Amt (Lakh)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">Latest risk oscillation and amount trajectory.</p>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Signed Export Actions</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Generate signed artifacts for selected investigation case IDs
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={() => void runExport("pdf")}
                disabled={!canRunActions}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                <FileDown className="h-3.5 w-3.5" />
                {busyAction === "pdf" ? "Signing..." : "Signed PDF"}
              </button>
              <button
                onClick={() => void runExport("csv")}
                disabled={!canRunActions}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                {busyAction === "csv" ? "Signing..." : "Signed CSV"}
              </button>
              <button
                onClick={() => void runExport("bundle")}
                disabled={!canRunActions}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                <Archive className="h-3.5 w-3.5" />
                {busyAction === "bundle" ? "Bundling..." : "Regulator Bundle"}
              </button>
              <button
                onClick={() => void refreshAuditTelemetry()}
                disabled={!selectedCaseIds.length || busyAction !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                <FileSearch className="h-3.5 w-3.5" />
                {busyAction === "audit" ? "Verifying..." : "Verify Logs"}
              </button>
              <button
                onClick={() => void downloadChartsPdf()}
                disabled={!canExportChartsPdf}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:cursor-not-allowed"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {busyAction === "chart-pdf" ? "Building..." : "PDF with Charts"}
              </button>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-[11px] font-semibold">Selected Case IDs</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {selectedCaseDetails.length
                  ? selectedCaseDetails.map((entry) => entry.case_id).join(", ")
                  : "No cases selected yet."}
              </p>
            </div>
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-success" />
                Compliance Snapshot
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Signature and immutable audit chain verification details
              </p>
            </div>

            {lastReceipt ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
                <p className="text-[11px] font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Last Signature Receipt
                </p>
                <p className="text-[11px] text-muted-foreground">File: {lastReceipt.filename}</p>
                <p className="text-[11px] text-muted-foreground">
                  Algorithm: {lastReceipt.signatureAlgorithm ?? "n/a"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Digest: {shortHash(lastReceipt.digestSha256)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Signature: {shortHash(lastReceipt.signature)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Signed At: {lastReceipt.signedAt ?? "n/a"}
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
                No signed export generated in this session.
              </p>
            )}

            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
              <p className="text-[11px] font-semibold">Immutable Activity Logs</p>
              <p className="text-[11px] text-muted-foreground">
                Status: {auditValid === null ? "not verified" : auditValid ? "verified" : "failed"}
              </p>
              <p className="text-[11px] text-muted-foreground">Reason: {auditReason ?? "n/a"}</p>
              <p className="text-[11px] text-muted-foreground">Records: {auditLogCount ?? "n/a"}</p>
              <p className="text-[11px] text-muted-foreground">Latest Hash: {shortHash(auditLatestHash)}</p>
            </div>
          </div>
        </div>
      </SectionReveal>
    </div>
  );
}
