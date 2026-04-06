import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types/domain";

const names = ["Axis Bank", "HDFC", "SBI", "ICICI", "PNB", "Kotak", "Yes Bank", "BOB", "IndusInd", "Federal Bank"];
const destinations = ["Merchant #4491", "Crypto Exchange", "Shell Co.", "E-commerce", "Insurance Corp", "Offshore Acct", "Utility Provider", "0xF3..a9", "International Wire", "Multiple Recipients"];
const types = ["UPI", "NEFT", "RTGS", "Wire Transfer", "SWIFT", "POS Payment", "Auto-Debit", "Bulk Transfer"];
const statuses: Transaction["status"][] = ["approved", "blocked", "flagged", "pending"];

let counter = 9000;

function randomTx(): Transaction {
  counter++;
  const risk = Math.random() > 0.7 ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 40) + 5;
  const status = risk >= 80 ? (Math.random() > 0.3 ? "blocked" : "flagged") : risk >= 50 ? "flagged" : "approved";
  return {
    id: `TXN-${counter}`,
    from: `${names[Math.floor(Math.random() * names.length)]} ****${Math.floor(1000 + Math.random() * 9000)}`,
    to: destinations[Math.floor(Math.random() * destinations.length)],
    amount: Math.floor(1000 + Math.random() * 1500000),
    currency: "INR",
    timestamp: new Date().toISOString(),
    riskScore: risk,
    status,
    type: types[Math.floor(Math.random() * types.length)],
    institution: names[Math.floor(Math.random() * names.length)],
  };
}

export function useLiveTransactions(initialTxs: Transaction[], interval = 4000, maxItems = 15) {
  const [liveTxs, setLiveTxs] = useState<Transaction[]>(initialTxs);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setLiveTxs((prev) => [randomTx(), ...prev].slice(0, maxItems));
    }, interval);
    return () => clearInterval(id);
  }, [isLive, interval, maxItems]);

  const toggleLive = useCallback(() => setIsLive((p) => !p), []);

  return { liveTxs, isLive, toggleLive };
}
