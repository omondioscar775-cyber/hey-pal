import { Suspense } from "react";
import { Planner } from "../../components/ExecutionWorkspace";
import { plannerPeriods } from "../../lib/planning";

type Props = { searchParams: Promise<{ goal?: string; period?: string }> };

async function Content({ searchParams }: Props) {
  const { goal, period } = await searchParams;
  return (
    <Planner
      goalId={typeof goal === "string" ? goal : undefined}
      period={plannerPeriods.find((item) => item === period)}
    />
  );
}

export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="workspace" role="status">
          Opening your planner…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
