import Link from "next/link";

const steps = [
  "Define your ambition",
  "Create your roadmap",
  "Plan your week",
  "Focus on meaningful work",
  "Recover intelligently",
  "Review your progress",
];

export default function Home() {
  return (
    <div className="marketing">
      <header className="site-header">
        <Link className="brand" href="/">
          {" "}
          <span aria-hidden="true">◉</span> CircleUp
        </Link>
        <nav aria-label="Product">
          <a href="#how">How it works</a>
          <a href="#recovery">Recovery</a>
        </nav>
        <div className="actions">
          <Link href="/login">Log in</Link>
          <Link className="button compact" href="/register">
            Get started
          </Link>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div>
            <span className="eyebrow">GOALS · PLANNING · RECOVERY</span>
            <h1>
              Turn Ambition Into <em>Achievement.</em>
            </h1>
            <p>
              Build realistic plans for your biggest goals, stay focused on what
              matters, and find your way forward when life interrupts your
              progress.
            </p>
            <div className="actions">
              <Link className="button" href="/register">
                Start Your Journey
              </Link>
              <a className="button secondary" href="#how">
                Explore How It Works
              </a>
            </div>
          </div>
          <div className="preview" aria-label="Illustrative CircleUp workspace">
            <div className="preview-bar">
              <span aria-hidden="true">● ● ●</span>
              <span>Example workspace</span>
            </div>
            <div className="preview-body">
              <div className="preview-rail" aria-hidden="true">
                ◉<br />▦<br />◎<br />◷
              </div>
              <div className="preview-main">
                <span className="eyebrow">MY ROADMAP</span>
                <h2>Run a first 10K</h2>
                <p>Build a consistent running routine</p>
                <div className="preview-row">
                  <span>✓</span>
                  <div>
                    <strong>Build a steady base</strong>
                    <small>Milestone complete</small>
                  </div>
                </div>
                <div className="preview-row">
                  <span>◷</span>
                  <div>
                    <strong>Extend the weekend run</strong>
                    <small>Next milestone</small>
                  </div>
                </div>
                <div className="preview-recovery">
                  <span>↻</span>
                  <div>
                    <strong>Make room for a changed week</strong>
                    <small>Review options for one missed session</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="marketing-section intro">
          <h2>Life changes. Your plan can change with it.</h2>
          <p>
            Big ambitions can feel overwhelming, especially when unfinished work
            builds up. CircleUp connects each action to a goal, so you can see
            what matters and decide how to continue.
          </p>
        </section>
        <section className="marketing-section" id="how">
          <span className="eyebrow">THE JOURNEY</span>
          <h2>How CircleUp works</h2>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <section className="marketing-section recovery-band" id="recovery">
          <div>
            <span className="eyebrow">INTELLIGENT RECOVERY</span>
            <h2>Find a way forward when plans change.</h2>
            <p>
              Review missed work, dependencies, and deadlines. Compare
              alternatives and see the proposed changes before approving a
              revised plan. Once approved, CircleUp applies the changes to your
              roadmap and calendar.
            </p>
          </div>
          <ol>
            <li>Review the original plan</li>
            <li>Identify missed work</li>
            <li>Assess the impact</li>
            <li>Compare recovery alternatives</li>
            <li>Approve an updated plan</li>
          </ol>
        </section>
        <section className="marketing-section">
          <h2>Make time for what matters.</h2>
          <div className="steps">
            {[
              ["Goal Roadmaps", "Break your ambition into milestones."],
              [
                "Smart Weekly Planning",
                "Compare scheduled effort with your available time.",
              ],
              ["Focus Sessions", "Give one task your full attention."],
              [
                "Intelligent Recovery",
                "Understand missed work and compare ways forward.",
              ],
              [
                "Progress Insights",
                "See tasks completed and milestones achieved.",
              ],
              [
                "Trusted Accountability · Upcoming",
                "Choose what to share with trusted peers.",
              ],
            ].map(([title, copy]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="marketing-section intro final-cta">
          <h2>Your goals deserve more than another to-do list.</h2>
          <Link className="button" href="/register">
            Create Your First Goal
          </Link>
        </section>
      </main>
      <footer className="site-header">
        <Link className="brand" href="/">
          ◉ CircleUp
        </Link>
        <span>From Ambition to Achievement, Together.</span>
        <Link href="/login">Log in</Link>
      </footer>
    </div>
  );
}
