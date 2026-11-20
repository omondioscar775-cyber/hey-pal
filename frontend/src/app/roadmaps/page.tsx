import { Suspense } from "react";
import { Roadmaps } from "../../components/ExecutionWorkspace";

type Props = { searchParams: Promise<{ goal?: string | string[] }> };

async function Content({ searchParams }: Props) {
  const { goal } = await searchParams;
  return <Roadmaps goalId={typeof goal === "string" ? goal : undefined} />;
}
export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="workspace" role="status">
          Opening your workspace…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
