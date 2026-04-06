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

export const transactions: Transaction[] = [
  { id: "TXN-8294", from: "Axis Bank ****3421", to: "Unknown Wallet 0xF3..a9", amount: 247500, currency: "INR", timestamp: "2024-03-15T14:23:00Z", riskScore: 94, status: "blocked", type: "Wire Transfer", institution: "Axis Bank" },
  { id: "TXN-8295", from: "HDFC ****7812", to: "Merchant #4491", amount: 12300, currency: "INR", timestamp: "2024-03-15T14:21:00Z", riskScore: 12, status: "approved", type: "POS Payment", institution: "HDFC Bank" },
  { id: "TXN-8296", from: "SBI ****0093", to: "Crypto Exchange", amount: 89000, currency: "INR", timestamp: "2024-03-15T14:18:00Z", riskScore: 78, status: "flagged", type: "Online Transfer", institution: "SBI" },
  { id: "TXN-8297", from: "ICICI ****5567", to: "Insurance Corp", amount: 45000, currency: "INR", timestamp: "2024-03-15T14:15:00Z", riskScore: 5, status: "approved", type: "Premium Payment", institution: "ICICI Bank" },
  { id: "TXN-8298", from: "PNB ****2234", to: "Shell Company Ltd", amount: 890000, currency: "INR", timestamp: "2024-03-15T14:10:00Z", riskScore: 97, status: "blocked", type: "NEFT", institution: "PNB" },
  { id: "TXN-8299", from: "Kotak ****9981", to: "E-commerce Store", amount: 3400, currency: "INR", timestamp: "2024-03-15T14:08:00Z", riskScore: 8, status: "approved", type: "UPI", institution: "Kotak Bank" },
  { id: "TXN-8300", from: "BOB ****4456", to: "Offshore Account", amount: 1250000, currency: "INR", timestamp: "2024-03-15T14:05:00Z", riskScore: 91, status: "blocked", type: "RTGS", institution: "Bank of Baroda" },
  { id: "TXN-8301", from: "Yes Bank ****7723", to: "Utility Provider", amount: 2100, currency: "INR", timestamp: "2024-03-15T14:02:00Z", riskScore: 3, status: "approved", type: "Auto-Debit", institution: "Yes Bank" },
  { id: "TXN-8302", from: "Axis Bank ****1198", to: "Multiple Recipients", amount: 567000, currency: "INR", timestamp: "2024-03-15T13:58:00Z", riskScore: 85, status: "flagged", type: "Bulk Transfer", institution: "Axis Bank" },
  { id: "TXN-8303", from: "HDFC ****3344", to: "International Wire", amount: 420000, currency: "INR", timestamp: "2024-03-15T13:55:00Z", riskScore: 62, status: "flagged", type: "SWIFT", institution: "HDFC Bank" },
];

export const alerts: Alert[] = [
  { id: "ALT-001", title: "Velocity Anomaly Detected", description: "15 transactions in 2 minutes from single account", severity: "critical", timestamp: "2024-03-15T14:23:00Z", transactionId: "TXN-8294" },
  { id: "ALT-002", title: "Shell Company Transfer", description: "Large transfer to entity with no trading history", severity: "critical", timestamp: "2024-03-15T14:10:00Z", transactionId: "TXN-8298" },
  { id: "ALT-003", title: "Crypto Conversion Pattern", description: "Fiat-to-crypto conversion matching known laundering pattern", severity: "high", timestamp: "2024-03-15T14:18:00Z", transactionId: "TXN-8296" },
  { id: "ALT-004", title: "Unusual Bulk Transfer", description: "Multiple small recipients from single high-value transfer", severity: "high", timestamp: "2024-03-15T13:58:00Z", transactionId: "TXN-8302" },
  { id: "ALT-005", title: "Cross-Border Threshold", description: "International wire approaching reporting threshold", severity: "medium", timestamp: "2024-03-15T13:55:00Z", transactionId: "TXN-8303" },
];

export const fraudDNAs: FraudDNA[] = [
  { id: "DNA-001", hash: "0x7f3a...9c2d", pattern: "Velocity Stacking", similarity: 97.3, detectedAt: "2024-03-15T14:23:00Z", source: "Axis Bank Network", category: "Transaction Layering" },
  { id: "DNA-002", hash: "0x4b1e...8f7a", pattern: "Shell Hop Pattern", similarity: 94.1, detectedAt: "2024-03-15T14:10:00Z", source: "Multi-Bank Detection", category: "Money Laundering" },
  { id: "DNA-003", hash: "0x2c9d...1e5b", pattern: "Crypto Wash Trading", similarity: 89.6, detectedAt: "2024-03-15T14:18:00Z", source: "SBI Monitoring", category: "Cryptocurrency Fraud" },
  { id: "DNA-004", hash: "0x8a4f...3d6c", pattern: "Smurfing Network", similarity: 92.8, detectedAt: "2024-03-14T09:30:00Z", source: "Cross-Bank Analysis", category: "Structuring" },
  { id: "DNA-005", hash: "0x1d7e...5a9f", pattern: "Account Takeover", similarity: 85.2, detectedAt: "2024-03-13T16:45:00Z", source: "HDFC Behavioral AI", category: "Identity Fraud" },
];

export const blockchainEntries: BlockchainEntry[] = [
  { txHash: "0x9f2a4b...7c3d8e1f", blockNumber: 18847291, timestamp: "2024-03-15T14:24:00Z", action: "STORE_FRAUD_DNA", fraudDnaHash: "0x7f3a...9c2d", status: "confirmed", gasUsed: 47832 },
  { txHash: "0x3e1d7c...2f8a9b4e", blockNumber: 18847285, timestamp: "2024-03-15T14:11:00Z", action: "FLAG_TRANSACTION", fraudDnaHash: "0x4b1e...8f7a", status: "confirmed", gasUsed: 52100 },
  { txHash: "0x6b8f2e...4a1c7d9f", blockNumber: 18847279, timestamp: "2024-03-15T14:19:00Z", action: "STORE_FRAUD_DNA", fraudDnaHash: "0x2c9d...1e5b", status: "confirmed", gasUsed: 48950 },
  { txHash: "0xa4c9d1...8e2f3b7c", blockNumber: 18847260, timestamp: "2024-03-15T13:59:00Z", action: "UPDATE_RISK_SCORE", fraudDnaHash: "0x8a4f...3d6c", status: "confirmed", gasUsed: 31200 },
  { txHash: "0x5f7b3a...1d9c4e8f", blockNumber: 18847250, timestamp: "2024-03-15T13:45:00Z", action: "SMART_CONTRACT_EXEC", fraudDnaHash: "0x1d7e...5a9f", status: "pending", gasUsed: 68400 },
];

export const institutions: Institution[] = [
  { id: "INST-001", name: "HDFC Bank", type: "Commercial Bank", trustScore: 96, status: "active", nodesCount: 12, lastSync: "2024-03-15T14:20:00Z" },
  { id: "INST-002", name: "SBI", type: "Public Sector Bank", trustScore: 94, status: "active", nodesCount: 18, lastSync: "2024-03-15T14:18:00Z" },
  { id: "INST-003", name: "Axis Bank", type: "Commercial Bank", trustScore: 92, status: "active", nodesCount: 8, lastSync: "2024-03-15T14:22:00Z" },
  { id: "INST-004", name: "ICICI Bank", type: "Commercial Bank", trustScore: 95, status: "active", nodesCount: 14, lastSync: "2024-03-15T14:15:00Z" },
  { id: "INST-005", name: "PNB", type: "Public Sector Bank", trustScore: 88, status: "active", nodesCount: 10, lastSync: "2024-03-15T14:05:00Z" },
  { id: "INST-006", name: "RBI CFMC", type: "Regulator", trustScore: 99, status: "active", nodesCount: 3, lastSync: "2024-03-15T14:23:00Z" },
];

export const modelUpdates: ModelUpdate[] = [
  { id: "MU-001", institution: "HDFC Bank", version: "v3.2.1", accuracy: 97.8, timestamp: "2024-03-15T12:00:00Z", status: "merged", improvement: 1.2 },
  { id: "MU-002", institution: "SBI", version: "v3.2.0", accuracy: 96.4, timestamp: "2024-03-15T10:30:00Z", status: "merged", improvement: 0.8 },
  { id: "MU-003", institution: "Axis Bank", version: "v3.1.9", accuracy: 95.9, timestamp: "2024-03-15T08:00:00Z", status: "validating", improvement: 0.5 },
  { id: "MU-004", institution: "ICICI Bank", version: "v3.2.1", accuracy: 97.1, timestamp: "2024-03-14T22:00:00Z", status: "merged", improvement: 1.5 },
  { id: "MU-005", institution: "PNB", version: "v3.1.8", accuracy: 93.2, timestamp: "2024-03-14T18:00:00Z", status: "rejected", improvement: -0.3 },
];

export const fraudTrendData = [
  { date: "Jan", detected: 142, blocked: 138, loss: 2.1 },
  { date: "Feb", detected: 168, blocked: 161, loss: 1.8 },
  { date: "Mar", detected: 191, blocked: 187, loss: 1.2 },
  { date: "Apr", detected: 156, blocked: 152, loss: 1.5 },
  { date: "May", detected: 203, blocked: 199, loss: 0.9 },
  { date: "Jun", detected: 178, blocked: 175, loss: 0.7 },
  { date: "Jul", detected: 224, blocked: 221, loss: 0.5 },
  { date: "Aug", detected: 198, blocked: 196, loss: 0.4 },
  { date: "Sep", detected: 245, blocked: 243, loss: 0.3 },
  { date: "Oct", detected: 267, blocked: 265, loss: 0.2 },
  { date: "Nov", detected: 289, blocked: 288, loss: 0.1 },
  { date: "Dec", detected: 312, blocked: 311, loss: 0.1 },
];

export const riskDistribution = [
  { name: "Low (0-30)", value: 67, fill: "hsl(142, 72%, 45%)" },
  { name: "Medium (31-60)", value: 18, fill: "hsl(38, 92%, 50%)" },
  { name: "High (61-80)", value: 10, fill: "hsl(25, 95%, 53%)" },
  { name: "Critical (81-100)", value: 5, fill: "hsl(0, 72%, 51%)" },
];

export const networkGraphData = {
  nodes: [
    { id: "acc1", label: "****3421", type: "source", risk: 94 },
    { id: "acc2", label: "0xF3..a9", type: "destination", risk: 98 },
    { id: "acc3", label: "Shell Co.", type: "entity", risk: 97 },
    { id: "acc4", label: "****2234", type: "source", risk: 91 },
    { id: "acc5", label: "Offshore", type: "destination", risk: 95 },
    { id: "acc6", label: "Crypto Ex", type: "exchange", risk: 78 },
  ],
  edges: [
    { from: "acc1", to: "acc2" },
    { from: "acc2", to: "acc3" },
    { from: "acc4", to: "acc3" },
    { from: "acc3", to: "acc5" },
    { from: "acc1", to: "acc6" },
    { from: "acc6", to: "acc5" },
  ],
};
