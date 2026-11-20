import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing and account routes are responsive and keyboard accessible", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const vitals = { lcp: 0, cls: 0 };
    Object.assign(window, { circleupVitals: vitals });
    new PerformanceObserver((list) => {
      vitals.lcp = list.getEntries().at(-1)?.startTime ?? 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      })[]) {
        if (!entry.hadRecentInput) vitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Turn Ambition Into Achievement." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { circleupVitals?: { lcp: number } })
            .circleupVitals?.lcp ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  const vitals = await page.evaluate(
    () =>
      (window as Window & { circleupVitals?: { lcp: number; cls: number } })
        .circleupVitals,
  );
  await test.info().attach("landing-lab-vitals", {
    body: JSON.stringify(vitals),
    contentType: "application/json",
  });
  console.log("Landing lab vitals (" + test.info().project.name + ")", vitals);
  await page.getByRole("link", { name: "Log in", exact: true }).first().click();
  await page.getByLabel("Email").fill("taylor@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid credentials",
  );
  await page.getByRole("button", { name: "Show password" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("registration, goal, approval, workload, focus and recovery use the workspace", async ({
  page,
  context,
  isMobile,
}) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Taylor Kim");
  await page.getByLabel("Email").fill("taylor@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  const signUp = page.waitForResponse((response) =>
    response.url().endsWith("/api/circleup/auth/register"),
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect(await (await signUp).json()).not.toHaveProperty("token");
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "circleup_session",
    )?.httpOnly,
  ).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("circleup_token")),
  ).toBeNull();

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "What would you like to achieve?" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create Your First Goal" }).click();
  await page.getByLabel("Goal title").fill("Complete a 10K");
  await page.getByLabel("Category").fill("Fitness");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Personal motivation").fill("Build healthy habits");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByLabel("Current situation", { exact: false })
    .fill("I currently run twice a week");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Measurable outcome").fill("Finish one 10K");
  await page.getByLabel("Target date").fill("2099-05-01");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Hours per week").fill("1");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Build healthy habits")).toBeVisible();
  await page.getByRole("button", { name: "Create My Goal" }).click();
  await expect(
    page.getByRole("heading", { name: "Complete a 10K" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit goal" }).click();
  await page.getByLabel("Goal title").fill("Finish a 10K");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(
    page.getByRole("heading", { name: "Finish a 10K" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Create roadmap" }).click();
  await page.getByRole("button", { name: "Create roadmap draft" }).click();
  const draft = page.getByRole("dialog", { name: "Review your roadmap" });
  await expect(draft).toBeVisible();
  const api = context.request;
  expect(
    (await (await api.get("/api/circleup/roadmaps")).json()).roadmaps,
  ).toHaveLength(0);
  await draft.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: "Approve saved draft" }).click();
  await expect(page.getByText("Roadmap activated.")).toBeVisible();

  await page.goto("/planner");
  await page.getByRole("button", { name: "Open calendar bookings" }).click();
  await expect(
    page.getByText("Free time in the next seven calendar days", {
      exact: false,
    }),
  ).toBeVisible();
  const day = await page.evaluate(() => {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  });
  await page.getByLabel("Start time").fill(day + "T13:00");
  await page.getByLabel("End time").fill(day + "T14:00");
  await page.getByRole("button", { name: "Preview booking" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm booking" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Calendar booking saved.")).toBeVisible();
  await page.getByRole("button", { name: "New task" }).click();
  const taskEditor = page.getByRole("dialog", { name: "Create a task" });
  await taskEditor.getByLabel("Task Title").fill("Run interval session");
  await taskEditor.getByLabel("Minutes").fill("90");
  await taskEditor
    .getByRole("button", { name: "Create Task", exact: true })
    .click();
  await expect(
    page.getByText("Scheduled work exceeds this goal’s capacity"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Focus", exact: true }).last().click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Finish Session" }).click();
  await expect(
    page.getByRole("heading", { name: "Session summary" }),
  ).toBeFocused();
  const tasks = (await (await api.get("/api/circleup/tasks")).json()).tasks;
  expect(tasks[0].status).toBe("pending");
  expect(
    (
      await api.patch("/api/circleup/tasks/" + tasks[0]._id, {
        data: { status: "missed" },
      })
    ).ok(),
  ).toBe(true);

  await page.goto("/recovery");
  await expect(
    page.getByRole("heading", { name: "Compare recovery alternatives" }),
  ).toBeVisible();
  await expect(
    page.getByText("Does not fit current constraints", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview Redistribute Work" }).click();
  const preview = page.getByRole("dialog", { name: "Redistribute Work" });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Confirm Recovery Plan" }),
  ).toBeDisabled();
  await expect(
    preview.getByRole("link", { name: "Open planner" }),
  ).toHaveAttribute("href", /period=Overdue$/);
  await expect(
    preview.getByText(
      "Generate a recovery plan above to apply verified changes.",
      {
        exact: false,
      },
    ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).not.toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.getByRole("button", { name: "Generate options" }).click();
  await page
    .getByRole("button", { name: "Review Redistribute Work", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Verified calendar placement."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply recovery plan" }).click();
  await expect(page.getByText("Recovery plan applied.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No missed work to review" }),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("Recorded focus time")).toBeVisible();
  await page
    .getByLabel("What did you accomplish?")
    .fill("Finished an interval session.");
  await page.getByRole("button", { name: "Save Review" }).click();
  await expect(page.getByText("Review saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("What did you accomplish?")).toHaveValue(
    "Finished an interval session.",
  );
  if (isMobile)
    await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await api.get("/api/circleup/goals")).status()).toBe(401);
});
