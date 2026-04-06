export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  timestamp: string;
  riskScore: number;
  status: "approved" | "blocked" | "flagged" | "pending";
  type: string;
  institution: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  transactionId: string;
}

export interface FraudDNA {
  id: string;
  hash: string;
  pattern: string;
  similarity: number;
  detectedAt: string;
  source: string;
  category: string;
}

export interface BlockchainEntry {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  action: string;
  fraudDnaHash: string;
  status: "confirmed" | "pending";
  gasUsed: number;
}

export interface Institution {
  id: string;
  name: string;
  type: string;
  trustScore: number;
  status: "active" | "suspended" | "pending";
  nodesCount: number;
  lastSync: string;
}

export interface ModelUpdate {
  id: string;
  institution: string;
  version: string;
  accuracy: number;
  timestamp: string;
  status: "merged" | "validating" | "rejected";
  improvement: number;
}
