# CircleUp: Full-Stack Project Documentation

**Platform:** Goal, Roadmap & Daily Task Execution Platform  
**Version:** 1.0.0  
**Date:** November 2026  
**Word Document Export:** [`CircleUp_Project_Documentation.docx`](file:///home/oscar/class/projects/CircleUp/CircleUp_Project_Documentation.docx)

---

## 1. Executive Summary & Overview

**CircleUp** is a full-stack goal-setting and execution platform designed to eliminate the friction between high-level long-term ambitions and daily actionable execution.

While conventional productivity tools either act as high-level vision boards without actionable daily structure or simple detached to-do lists, CircleUp unites these layers into an interconnected hierarchy:
1. **Goals**: Define long-term objectives, current capability, desired outcomes, and weekly time allocations.
2. **Roadmaps**: Progressive, versioned multi-milestone strategic roadmaps that adapt as goals evolve.
3. **Tasks**: Concrete daily execution items with priority flags, dependencies, and time tracking.

---

## 2. Technology Stack

### 2.1 Backend Architecture
- **Runtime**: Node.js (v20+) with native ES Modules (`"type": "module"`).
- **Web Framework**: Express 5.3.0.
- **Language**: TypeScript 7.0 (Strict mode, module resolution `node16`).
- **Database**: MongoDB with Mongoose 9.12 ODM.
- **Authentication**: JWT (`jsonwebtoken` 9.0) with custom Express request augmentation.
- **Password Security**: Bcrypt with salt factor 12.
- **Validation**: Zod 4.6 for runtime schema validation on all request bodies.
- **Security & Infrastructure**: Helmet, CORS, Morgan logger, Express Rate Limit (100 reqs/15m).

### 2.2 Frontend Architecture
- **Framework**: Next.js 16.4.6 with App Router & Turbopack.
- **UI Library**: React 19.3.0.
- **Styling**: Tailwind CSS v4.
- **State Management**: Centralized `AuthProvider` with an HttpOnly session cookie issued by the Next.js proxy. See the [frontend implementation and verification report](frontend/README.md).
- **API Integration**: Unified typed API client with automatic Bearer token injection.

---

## 3. Data Architecture & Database Models

### 3.1 User Model (`User.ts`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Primary Key | Unique user identifier |
| `name` | `String` | Required, 2-80 chars | User full name |
| `email` | `String` | Required, Unique, Lowercase | Login email address |
| `password` | `String` | Required, Select: false | Bcrypt hashed password |
| `createdAt` | `Date` | Timestamp | Account creation timestamp |

### 3.2 Goal Model (`Goal.ts`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Primary Key | Unique goal identifier |
| `userId` | `ObjectId` | Indexed, Ref: User | Owning user ID |
| `title` | `String` | Required, 3-150 chars | Goal title |
| `description`| `String` | Optional, max 1000 | Detailed goal context |
| `category` | `String` | Required | e.g. Career, Skills, Health |
| `currentState` | `String` | Required | Baseline user state |
| `desiredOutcome`| `String` | Required | Target benchmark |
| `weeklyAvailableHours`| `Number` | Required, 1-168 | Weekly committed hours |
| `status` | `String` | Enum | active, completed, paused, archived |

### 3.3 Roadmap Model (`Roadmap.ts`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Primary Key | Unique roadmap identifier |
| `userId` | `ObjectId` | Indexed, Ref: User | Owning user ID |
| `goalId` | `ObjectId` | Indexed, Ref: Goal | Associated goal ID |
| `version` | `Number` | Required, min 1 | Auto-incrementing version number |
| `title` | `String` | Required | Strategy roadmap title |
| `milestones` | `[Milestone]`| Subdocument array | Milestone stages with `completed` boolean |
| `status` | `String` | Enum | active, superseded, completed |

*Compound Index:* `{ goalId: 1, version: 1 }` (Unique).

### 3.4 Task Model (`Task.ts`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Primary Key | Unique task identifier |
| `userId` | `ObjectId` | Indexed, Ref: User | Owning user ID |
| `goalId` | `ObjectId` | Indexed, Ref: Goal | Associated goal ID |
| `roadmapId` | `ObjectId` | Indexed, Ref: Roadmap| Associated roadmap ID |
| `title` | `String` | Required, 3-150 chars | Actionable task name |
| `scheduledDate` | `Date` | Required, Indexed | Target completion date |
| `estimatedMinutes` | `Number` | Required, 1-1440 | Effort estimation |
| `priority` | `String` | Enum | low, medium, high, critical |
| `status` | `String` | Enum | pending, in_progress, completed, missed, cancelled |
| `isEssential`| `Boolean` | Default: false | Marks critical milestone progress items |
| `dependsOn` | `[ObjectId]` | Ref: Task array | Pre-requisite task dependencies |
| `completedAt`| `Date` | Timestamp | Automatically recorded on completion |

*Compound Index:* `{ userId: 1, scheduledDate: 1, status: 1 }`.

---

## 4. RESTful API Specification

All endpoints under `/api/goals`, `/api/roadmaps`, and `/api/tasks` require a valid JWT Bearer token:
`Authorization: Bearer <TOKEN>`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register account and receive JWT token |
| `POST` | `/api/auth/login` | Log in and receive JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/goals` | Create a new outcome goal |
| `GET` | `/api/goals` | Retrieve all goals for authenticated user |
| `GET` | `/api/goals/:id` | Retrieve goal details by ID |
| `PATCH` | `/api/goals/:id` | Update goal parameters |
| `DELETE` | `/api/goals/:id` | Delete goal |
| `POST` | `/api/roadmaps` | Create roadmap (auto-increments version and supersedes older) |
| `GET` | `/api/roadmaps` | List roadmaps (supports `?goalId=` and `?status=`) |
| `GET` | `/api/roadmaps/:id` | Retrieve roadmap by ID with populated goal details |
| `PATCH` | `/api/roadmaps/:id` | Update milestones or status |
| `DELETE` | `/api/roadmaps/:id` | Delete roadmap |
| `POST` | `/api/tasks` | Create task linked to goal & roadmap |
| `GET` | `/api/tasks` | List tasks (supports `date`, `startDate`, `endDate`, `status`, `priority`) |
| `GET` | `/api/tasks/:id` | Retrieve task by ID with populated goal, roadmap, and dependencies |
| `PATCH` | `/api/tasks/:id` | Update task & auto-manage `completedAt` timestamp |
| `DELETE` | `/api/tasks/:id` | Delete task & auto-clean dependency references |

### Automated roadmap draft generation

Opening roadmap creation generates a deterministic draft from the selected goal's title, category, current state, desired outcome, and weekly available hours. It includes four editable milestones; the goal target date is carried to the final milestone when provided. Users can change the goal, regenerate the draft, and edit milestones before approving it. Approval activates the roadmap; if another roadmap is active for that goal, the UI explains that it will be superseded and retained in history.

---

## 5. Development Roadmap & Verification Status

| Module | Status | Verification Summary |
| :--- | :--- | :--- |
| **Backend Setup** | Complete | Express 5 ESM server listening on port 5000 |
| **MongoDB Connection** | Implemented | Mongoose 9 connected to `mongodb://127.0.0.1:27017/circleup` |
| **Registration** | Complete | Bcrypt 12 rounds + JWT token response |
| **Login** | Complete | Password comparison + JWT generation |
| **JWT Authentication** | Complete | Bearer extraction + TypeScript Request augmentation |
| **User Profile** | Complete | `/api/auth/me` endpoint verified |
| **Goals API** | Complete | Verified: Create, Read, Update, Delete |
| **Roadmaps API and draft generation** | Implemented | CRUD/versioning plus deterministic, editable frontend drafts with explicit activation |
| **Tasks API** | Complete | Verified: Scheduling, priority, dependencies, completedAt timestamps |
| **Frontend Integration** | Complete | Next.js App Router and a same-origin proxy for supported Express routes |
| **Dashboard** | Complete | KPI cards, live action items feed, interactive goal progress widgets |

---

## 6. Local Setup Instructions

See the [backend implementation and replica-set setup](docs/BACKEND.md) for the current API, security model and operations guide.

### 6.1 Backend
```bash
cd backend
npm install
npm run dev
# Server runs at http://localhost:5000
```

### 6.2 Frontend
```bash
cd frontend
npm install
npm run dev
# Application available at http://localhost:3000
```
