import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, TrendingUp, AlertTriangle, Shield } from "lucide-react";

const predictions = [
  { id: 1, threat: "Cross-border smurfing via SWIFT", probability: 89, timeframe: "Next 6h", risk: "critical", recommendation: "Increase monitoring on international transfers > ₹10L" },
  { id: 2, threat: "Coordinated account takeover", probability: 72, timeframe: "Next 12h", risk: "high", recommendation: "Enable 2FA enforcement for dormant accounts" },
  { id: 3, threat: "UPI fraud surge (weekend)", probability: 65, timeframe: "Next 24h", risk: "high", recommendation: "Lower velocity thresholds for UPI transactions" },
  { id: 4, threat: "Crypto wash trading pattern", probability: 54, timeframe: "Next 48h", risk: "medium", recommendation: "Monitor fiat-to-crypto conversion patterns" },
];

export default function ThreatPredictor() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">AI Threat Predictor</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono ml-auto">
          PREDICTIVE AI
        </span>
      </div>
      <div className="space-y-2">
        {predictions.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
            className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                p.risk === "critical" ? "bg-destructive/10" : p.risk === "high" ? "bg-warning/10" : "bg-accent/10"
              }`}>
                <span className={`text-sm font-bold font-mono ${
                  p.risk === "critical" ? "text-destructive" : p.risk === "high" ? "text-warning" : "text-accent"
                }`}>{p.probability}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{p.threat}</p>
                <p className="text-[10px] text-muted-foreground">ETA: {p.timeframe}</p>
              </div>
              <AlertTriangle className={`w-4 h-4 shrink-0 ${
                p.risk === "critical" ? "text-destructive" : p.risk === "high" ? "text-warning" : "text-accent"
              }`} />
            </div>
            {expandedId === p.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 pt-3 border-t border-border"
              >
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-primary">AI Recommendation</p>
                    <p className="text-[11px] text-muted-foreground">{p.recommendation}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
