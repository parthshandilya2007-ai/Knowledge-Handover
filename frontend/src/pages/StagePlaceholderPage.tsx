import { Link } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";

export function StagePlaceholderPage({
  stageNumber,
  title,
  description
}: {
  stageNumber: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-4">
        <Clock className="w-6 h-6" />
      </div>
      <span className="text-xs uppercase tracking-wider font-mono text-accent mb-2">
        Scheduled for Stage {stageNumber}
      </span>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-text-secondary mb-6 leading-relaxed">{description}</p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white hover:border-accent transition-colors"
      >
        Return to Dashboard
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
