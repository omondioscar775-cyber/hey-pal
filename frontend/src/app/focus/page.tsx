import { Suspense } from "react";
import { Focus } from "../../components/ExecutionWorkspace";

type Props = { searchParams: Promise<{ task?: string | string[] }> };

async function Content({ searchParams }: Props) {
  const { task } = await searchParams;
  return <Focus taskId={typeof task === "string" ? task : undefined} />;
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
