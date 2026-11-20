"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleDot,
  Compass,
  LayoutDashboard,
  Menu,
  PanelLeft,
  RotateCcw,
  Settings,
  Target,
  Timer,
  Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../context/AuthContext";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/goals", "My Goals", Target],
  ["/roadmaps", "Roadmaps", Compass],
  ["/planner", "Planner", CalendarDays],
  ["/focus", "Focus", Timer],
  ["/recovery", "Recovery Centre", RotateCcw],
  ["/progress", "Progress", ChartNoAxesColumnIncreasing],
  ["/circles", "Circles", Users],
  ["/settings", "Settings", Settings],
] as const;

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const { user, isLoading, sessionError, refreshUser, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isLoading && !user && !sessionError) router.replace("/login");
  }, [isLoading, user, router, sessionError]);
  const closeDrawer = useCallback(() => drawer.current?.close(), []);

  if (sessionError && !user)
    return (
      <main className="workspace">
        <ErrorState message={sessionError} retry={() => void refreshUser()} />
      </main>
    );
  if (!user || isLoading)
    return (
      <main className="workspace" role="status">
        Opening your workspace…
      </main>
    );
  return (
    <div className={collapsed ? "app-frame collapsed" : "app-frame"}>
      <a href="#main-content" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <CircleDot aria-hidden="true" size={24} />
          <span className="nav-label">CircleUp</span>
        </Link>
        <nav aria-label="Workspace">
          <NavigationLinks path={path} />
        </nav>
        <button
          className="account"
          onClick={() => void logout()}
          aria-label="Log out"
        >
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <span className="nav-label">
            {user.name}
            <small>Log out</small>
          </span>
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button desktop-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeft aria-hidden="true" size={20} />
          </button>
          <Link className="brand mobile-brand" href="/dashboard">
            <CircleDot aria-hidden="true" size={22} />
            CircleUp
          </Link>
          <span className="top-title">{title}</span>
          <Link
            className="avatar"
            href="/settings"
            aria-label="Account settings"
          >
            {user.name.slice(0, 1)}
          </Link>
        </header>
        <main className="workspace" id="main-content" tabIndex={-1}>
          {sessionError && <ErrorState message={sessionError} />}
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Quick navigation">
        {[
          [0, "Home"],
          [1, "Goals"],
          [3, "Planner"],
          [5, "Recovery"],
        ].map(([index, label]) => {
          const [href, , Icon] = links[Number(index)];
          return (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={19} />
              {label}
            </Link>
          );
        })}
        <button onClick={() => drawer.current?.showModal()}>
          <Menu aria-hidden="true" size={19} />
          More
        </button>
      </nav>
      <dialog
        ref={drawer}
        className="nav-dialog"
        aria-labelledby="navigation-title"
      >
        <div className="heading">
          <h2 id="navigation-title">Workspace</h2>
          <button
            autoFocus
            className="button secondary"
            onClick={() => drawer.current?.close()}
          >
            Close
          </button>
        </div>
        <nav aria-label="All workspace pages">
          <NavigationLinks path={path} onNavigate={closeDrawer} />
        </nav>
        <button className="button secondary" onClick={() => void logout()}>
          Log out
        </button>
      </dialog>
    </div>
  );
}

function NavigationLinks({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate?: () => void;
}) {
  return links.map(([href, name, Icon]) => (
    <Link
      key={href}
      href={href}
      title={name}
      onClick={onNavigate}
      aria-current={
        path === href || path.startsWith(href + "/") ? "page" : undefined
      }
    >
      <Icon aria-hidden="true" size={19} />
      <span className="nav-label">{name}</span>
    </Link>
  ));
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="heading page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card empty">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      {message}
      {retry && (
        <button className="button secondary compact" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div className="card skeleton" role="status">
      Loading workspace data…
    </div>
  );
}
