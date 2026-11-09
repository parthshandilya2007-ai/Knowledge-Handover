import { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-text-secondary">
      <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-surface-border bg-panel/30">
      <div className="w-12 h-12 rounded-full bg-surface-border/50 flex items-center justify-center text-text-secondary mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export function ErrorCard({
  title = "Something went wrong",
  message,
  onRetry
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-red-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-200">{title}</h4>
          <p className="text-xs text-red-300/80 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1 text-xs font-medium rounded bg-red-900/50 hover:bg-red-800/60 border border-red-500/30 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
