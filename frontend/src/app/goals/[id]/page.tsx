import { Suspense } from "react";
import { GoalDetails } from "../../../components/GoalsWorkspace";

type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  return <GoalDetails id={(await params).id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="workspace" role="status">
          Opening your goal…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
