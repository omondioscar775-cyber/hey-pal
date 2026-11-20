import type { Goal, Milestone } from "../types/index";

export interface RoadmapDraft {
  title: string;
  milestones: Milestone[];
}

const categoryFocus: Record<string, string> = {
  career: "role-relevant skills and evidence of your work",
  skills: "foundational knowledge and deliberate practice",
  health: "safe, sustainable habits and measurable wellbeing markers",
  finance: "budgeting habits, savings, and regular financial check-ins",
  personal: "repeatable habits and real-life practice",
};

const practicalSteps: Record<string, string> = {
  career: "Complete a role-relevant project or portfolio piece.",
  skills: "Build a small project that demonstrates the skill in practice.",
  health: "Follow the routine consistently and record a simple progress measure.",
  finance: "Run the plan through a review period and record the result.",
  personal: "Practice the habit in real situations and track consistency.",
};

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

export function generateRoadmapDraft(goal: Goal): RoadmapDraft {
  const categoryKey = goal.category.trim().toLowerCase();
  const categoryLabel = goal.category.trim().toLowerCase() || "your goal";
  const focus =
    categoryFocus[categoryKey] ?? `the skills and habits needed for ${categoryLabel}`;
  const practicalStep =
    practicalSteps[categoryKey] ??
    "Complete a practical step that demonstrates progress toward your outcome.";
  const currentState = goal.currentState.trim();
  const desiredOutcome = goal.desiredOutcome.trim();

  return {
    title: truncate(`Roadmap: ${goal.title.trim()}`, 150),
    milestones: [
      {
        title: "Define success and establish your baseline",
        description: truncate(
          `Starting point: ${currentState}. Define clear evidence that will show progress toward ${desiredOutcome}.`,
          1000
        ),
        completed: false,
      },
      {
        title: `Build your ${categoryLabel} foundations`,
        description: truncate(
          `Focus on ${focus}. Plan your effort around the ${goal.weeklyAvailableHours} hours per week you have available.`,
          1000
        ),
        completed: false,
      },
      {
        title: "Apply your progress in practice",
        description: truncate(
          `${practicalStep} Use the result to identify what still stands between your current state and ${desiredOutcome}.`,
          1000
        ),
        completed: false,
      },
      {
        title: "Review progress and close remaining gaps",
        description: truncate(
          `Compare your results with ${desiredOutcome}. Record what is complete and identify any next steps before considering the goal achieved.`,
          1000
        ),
        targetDate: goal.targetDate,
        completed: false,
      },
    ],
  };
}
