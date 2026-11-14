import { IReportItem, IHandoverReport } from "../../types";
import { InteractiveKnowledgeGraph } from "./InteractiveKnowledgeGraph";

interface DependencyGraphViewProps {
  items: IReportItem[];
  report?: IHandoverReport;
}

export function DependencyGraphView({ items, report }: DependencyGraphViewProps) {
  return <InteractiveKnowledgeGraph items={items} report={report} />;
}
