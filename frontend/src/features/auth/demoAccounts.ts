export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  roleTitle: string;
  roleBadge: string;
  isJudge?: boolean;
  highlightColor: string;
  badgeColor: string;
  description: string;
  keyFeaturesToTest: string[];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "judge",
    name: "Hackathon Judge (Evaluator)",
    email: "judge@hackathon.dev",
    password: "Judge123!",
    roleTitle: "Lead Judge & Evaluator",
    roleBadge: "Full Unrestricted Access",
    isJudge: true,
    highlightColor: "border-amber-500/50 bg-amber-500/10 text-amber-200",
    badgeColor: "bg-amber-400/20 text-amber-300 border-amber-500/30",
    description: "Recommended for hackathon evaluation. Full unrestricted access across all platform modules, RAG AI assistant, conflict reconciliations, and confidential executive finance notes.",
    keyFeaturesToTest: [
      "Access to all 6 sources (including restricted Executive Headcount & Bonus)",
      "Interactive AI Chat with verbatim quote citations from confidential notes",
      "Full Handover Report with confidence scores & PostgreSQL vs MongoDB conflict",
      "Dependency Graph and Interactive Knowledge Graph exploration",
      "Manager view audit trail & PDF report streaming export",
    ],
  },
  {
    id: "admin",
    name: "Alex Chen",
    email: "admin@hackathon.dev",
    password: "Admin123!",
    roleTitle: "Lead Architect / System Admin",
    roleBadge: "Admin",
    highlightColor: "border-teal-500/50 bg-teal-500/10 text-teal-200",
    badgeColor: "bg-teal-400/20 text-teal-300 border-teal-500/30",
    description: "System architect with full workspace configuration privileges and unrestricted visibility over all organizational assets.",
    keyFeaturesToTest: [
      "Full administrative oversight",
      "Unrestricted document access & ingestion management",
      "Access to all audit logs and system health diagnostics",
    ],
  },
  {
    id: "manager",
    name: "Sarah Connor",
    email: "manager@hackathon.dev",
    password: "Manager123!",
    roleTitle: "Project Manager (Reviewer)",
    roleBadge: "PM / Approvals",
    highlightColor: "border-blue-500/50 bg-blue-500/10 text-blue-200",
    badgeColor: "bg-blue-400/20 text-blue-300 border-blue-500/30",
    description: "Project Manager responsible for approving report sections, reviewing architecture conflict resolutions, and verifying incoming developer readiness.",
    keyFeaturesToTest: [
      "Review & Approvals dashboard with section sign-offs",
      "Manager View Access Logs tracking sensitive document views",
      "Conflict Resolution tools for contradictory project specifications",
    ],
  },
  {
    id: "incoming-dev",
    name: "Jordan Lee",
    email: "incoming-dev@hackathon.dev",
    password: "Developer123!",
    roleTitle: "Incoming Developer",
    roleBadge: "Strict RBAC Filtered",
    highlightColor: "border-purple-500/50 bg-purple-500/10 text-purple-200",
    badgeColor: "bg-purple-400/20 text-purple-300 border-purple-500/30",
    description: "Demonstrates the platform's core zero-leakage security boundary. Notice how confidential finance notes and salary bands are completely hidden at the database layer!",
    keyFeaturesToTest: [
      "Zero-leakage security boundary: Confidential finance notes are completely hidden",
      "AI Assistant filters restricted knowledge - asking about bonuses yields zero evidence",
      "Personalized 5-day onboarding roadmap & actionable first-week plan",
    ],
  },
];

