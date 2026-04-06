import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface AnomalyEvent {
  id: number;
  type: string;
  institution: string;
  score: number;
  timestamp: string;
}

const anomalyTypes = [
  "Velocity Spike", "Geo Mismatch", "Account Takeover", "Unusual Pattern",
  "Cross-Border Anomaly", "Smurfing Detected", "Shell Company Link",
];
const banks = ["HDFC Bank", "SBI", "Axis Bank", "ICICI Bank", "PNB", "Kotak Bank"];

let eventId = 0;

export default function AnomalyPulse() {
  const [events, setEvents] = useState<AnomalyEvent[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      eventId++;
      const newEvent: AnomalyEvent = {
        id: eventId,
        type: anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)],
        institution: banks[Math.floor(Math.random() * banks.length)],
        score: Math.floor(70 + Math.random() * 30),
        timestamp: new Date().toLocaleTimeString(),
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 5));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Zap className="w-4 h-4 text-primary" />
        </motion.div>
        <h3 className="text-sm font-semibold">Live Anomaly Pulse</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-mono ml-auto">
          REAL-TIME
        </span>
      </div>
      <div className="space-y-2">
        <AnimatePresence>
          {events.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50"
            >
              <div className={`w-2 h-2 rounded-full ${e.score >= 90 ? "bg-destructive animate-pulse" : "bg-warning"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{e.type}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{e.institution}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-mono font-bold ${e.score >= 90 ? "text-destructive" : "text-warning"}`}>{e.score}</p>
                <p className="text-[10px] text-muted-foreground">{e.timestamp}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
