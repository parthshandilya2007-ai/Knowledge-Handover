import { IReportItem, IHandoverReport } from "../../types";
import { PersonalizedOnboardingRoadmap } from "./PersonalizedOnboardingRoadmap";

interface FirstWeekPlanViewProps {
  items: IReportItem[];
  report?: IHandoverReport;
}

export function FirstWeekPlanView({ items, report }: FirstWeekPlanViewProps) {
  return <PersonalizedOnboardingRoadmap items={items} report={report} />;
}
