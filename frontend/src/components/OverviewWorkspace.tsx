"use client";

import Link from "next/link";
import { WeeklyActivity } from "./WeeklyActivity";
import { WeeklyReview } from "./WeeklyReview";
import { ProgressHistory } from "./ProgressHistory";
import { useAuth } from "../context/AuthContext";
import { AppShell, EmptyState, PageHeader } from "./AppShell";
import {
  dateKey,
  displayDate,
  localDay,
  minutes,
  missedTask,
  openTask,
  relatedId,
  weekRange,
} from "../lib/planning";
import { WorkspaceData, type WorkspaceRecords } from "./WorkspaceData";

function Stats({ items }: { items: Array<[string, number | string]> }) {
  return (
    <div className="stats">
      {items.map(([label, value]) => (
        <div className="card stat" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function metrics({ goals, tasks, roadmaps }: WorkspaceRecords) {
  const active = goals.filter((goal) => goal.status === "active");
  const milestones = roadmaps
    .filter((item) => item.status !== "superseded")
    .flatMap((item) => item.milestones);
  const [start, end] = weekRange();
  const weekly = tasks.filter(
    (task) =>
      task.status !== "cancelled" &&
      dateKey(task.scheduledDate) >= start &&
      dateKey(task.scheduledDate) <= end,
  );
  const today = tasks.filter(
    (task) => openTask(task) && dateKey(task.scheduledDate) === localDay(),
  );
  const completed = weekly.filter((task) => task.status === "completed").length;
  const missed = tasks.filter((task) => missedTask(task));
  return { active, milestones, weekly, today, completed, missed };
}
export function Dashboard() {
  const { user } = useAuth();
  return (
    <WorkspaceData title="Dashboard">
      {(records) => {
        const data = metrics(records);
        return (
          <>
            <PageHeader
              title={"Welcome" + (user ? ", " + user.name.split(" ")[0] : "")}
              description="Here’s what matters most for your goals."
            >
              <Link className="button" href="/onboarding">
                New goal
              </Link>
            </PageHeader>
            {!records.goals.length ? (
              <EmptyState title="What would you like to achieve?">
                <p>
                  Start with one goal and turn it into meaningful next steps.
                </p>
                <Link className="button" href="/onboarding">
                  Create Your First Goal
                </Link>
              </EmptyState>
            ) : (
              <>
                <Stats
                  items={[
                    ["Active goals", data.active.length],
                    ["Today’s tasks", data.today.length],
                    [
                      "Weekly progress",
                      data.completed + " / " + data.weekly.length,
                    ],
                    [
                      "Upcoming milestones",
                      data.milestones.filter((item) => !item.completed).length,
                    ],
                  ]}
                />
                <div className="split">
                  <div className="stack">
                    <section className="card">
                      <h2>Today’s priorities</h2>
                      {!data.today.length && (
                        <p>No open tasks scheduled for today.</p>
                      )}
                      {data.today.map((task) => (
                        <div className="line-item row" key={task._id}>
                          <div>
                            <strong>{task.title}</strong>
                            <p>
                              {minutes(task.estimatedMinutes)} · {task.priority}{" "}
                              priority
                            </p>
                          </div>
                          <Link
                            className="button secondary compact"
                            href={"/focus?task=" + task._id}
                          >
                            Start focus
                          </Link>
                        </div>
                      ))}
                    </section>
                    <section className="card">
                      <h2>Active goal roadmaps</h2>
                      {!data.active.length && <p>No active goals.</p>}
                      {data.active.map((goal) => {
                        const roadmap = records.roadmaps.find(
                          (item) =>
                            item.status === "active" &&
                            relatedId(item.goalId) === goal._id,
                        );
                        return (
                          <div className="line-item" key={goal._id}>
                            <Link
                              className="text-link"
                              href={"/goals/" + goal._id}
                            >
                              {goal.title}
                            </Link>
                            <p>{roadmap?.title ?? "Roadmap ready to create"}</p>
                          </div>
                        );
                      })}
                    </section>
                    <section className="card">
                      <h2>Weekly activity</h2>
                      <p>
                        {data.completed} of {data.weekly.length} tasks scheduled
                        this week are complete.
                      </p>
                      {data.weekly.length > 0 && (
                        <progress
                          value={data.completed}
                          max={data.weekly.length}
                          aria-label="Tasks completed this week"
                        />
                      )}
                    </section>
                  </div>
                  <div className="stack">
                    <section className="card">
                      <h2>Recovery</h2>
                      <p>
                        {data.missed.length
                          ? data.missed.length + " missed tasks to review."
                          : "No missed work to review."}
                      </p>
                      <Link className="text-link" href="/recovery">
                        Open Recovery Centre
                      </Link>
                    </section>
                    <section className="card">
                      <h2>Upcoming deadlines</h2>
                      {data.active
                        .filter(
                          (goal) =>
                            goal.targetDate &&
                            dateKey(goal.targetDate) >= localDay(),
                        )
                        .sort((a, b) =>
                          a.targetDate!.localeCompare(b.targetDate!),
                        )
                        .slice(0, 4)
                        .map((goal) => (
                          <div className="line-item" key={goal._id}>
                            {goal.title}
                            <p>{displayDate(goal.targetDate)}</p>
                          </div>
                        ))}
                    </section>
                    <section className="card stack">
                      <h2>Quick actions</h2>
                      <Link className="text-link" href="/planner">
                        Plan your week
                      </Link>
                      <Link className="text-link" href="/progress">
                        Review progress
                      </Link>
                    </section>
                  </div>
                </div>
              </>
            )}
          </>
        );
      }}
    </WorkspaceData>
  );
}

export function Progress() {
  return (
    <WorkspaceData title="Progress">
      {(records) => {
        const data = metrics(records);
        return (
          <>
            <PageHeader
              title="Progress"
              description="See what you’ve accomplished and reflect on what helped."
            />
            <Stats
              items={[
                [
                  "Goals completed",
                  records.goals.filter((goal) => goal.status === "completed")
                    .length,
                ],
                [
                  "Milestones achieved",
                  data.milestones.filter((item) => item.completed).length,
                ],
                ["Weekly tasks complete", data.completed],
                ["Missed work", data.missed.length],
              ]}
            />
            <div className="split">
              <section className="card">
                <h2>Scheduled work this week</h2>
                <p>
                  {data.completed} completed of {data.weekly.length} planned
                  tasks.
                </p>
                {data.weekly.length > 0 && (
                  <progress
                    aria-label="Weekly tasks completed"
                    value={data.completed}
                    max={data.weekly.length}
                  />
                )}
                {data.weekly.length > 0 && (
                  <WeeklyActivity tasks={data.weekly} />
                )}
                <ProgressHistory />
              </section>
              <WeeklyReview />
            </div>
          </>
        );
      }}
    </WorkspaceData>
  );
}

export function Settings() {
  const { user } = useAuth();
  return (
    <AppShell title="Settings">
      <PageHeader
        title="Settings"
        description="Review your account and workspace preferences."
      />
      <div className="grid-cards">
        <section className="card">
          <h2>Profile and account</h2>
          <p>{user?.name}</p>
          <p>{user?.email}</p>
        </section>
        {[
          [
            "Security",
            "Use Forgot password on the sign-in page to request a reset.",
          ],
          ["Time preferences", "Set weekly hours on each goal."],
          ["Privacy", "Your goals are visible only in your own account."],
          ["Notifications", "Notification preferences are upcoming."],
          ["Appearance", "CircleUp currently uses its light theme."],
          ["Data management", "Export and account deletion are upcoming."],
        ].map(([name, copy]) => (
          <section className="card" key={name}>
            <h2>{name}</h2>
            <p>{copy}</p>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
export function Circles() {
  return (
    <AppShell title="Circles">
      <PageHeader
        title="Circles"
        description="Trusted accountability · Upcoming"
      />
      <EmptyState title="Grow with people you trust">
        <p>
          Private Circles will let you invite peers and choose which commitments
          to share.
        </p>
        <Link className="button secondary" href="/goals">
          Return to your goals
        </Link>
      </EmptyState>
    </AppShell>
  );
}
