# 🚀 TaskFlow Release Notes — v0.1.0 (QA Handover)

**Project Name:** TaskFlow  
**Version:** `0.1.0-beta`  
**Release Date:** September 5, 2026  
**Target Environment:** Staging / QA  
**Repository:** [GitHub Repository](https://github.com/sriramselvaraj9/TaskFlow)

---

## 🔗 Quick Links for QA

| Resource | Link | Notes |
| :--- | :--- | :--- |
| 🌐 **QA / Deployment URL** | `https://task-flow-staging.vercel.app` *(or your deployed Vercel URL)* | Active staging environment ready for QA testing |
| 🎨 **Figma Design Link** | `https://www.figma.com/file/TaskFlow-UI-Design-System` *(replace with actual Figma link)* | Target mockups, design specs & component library |
| 📁 **GitHub Repository** | [sriramselvaraj9/TaskFlow](https://github.com/sriramselvaraj9/TaskFlow) | Branch: `main` |
| 📑 **API / DB Schema** | Embedded in `/server/database/seed.ts` & `db.json` | Mock/In-memory database with automatic fallback |

---

## 📝 Detailed Summary of Changes

### 1. 🔒 Authentication & Role-Based Access Control (RBAC)
- **NextAuth.js Integration:** Implemented credential provider authentication with bcrypt-hashed passwords.
- **Two User Roles:**
  - `ADMIN`: Full administrative access (Project creation/editing, member management, user invitations, system logs).
  - `MEMBER`: View and collaborate on assigned projects, create/update tasks, manage board workflow.
- **Password Reset & OTP Flow:** Simulated OTP-based password reset support with nodemailer integration.
- **Session Management:** Secure JWT session tokens and automated route protection for unauthorized routes (`/dashboard`, `/tasks`, `/projects`, `/analytics`, `/members`).

### 2. 📊 Interactive Kanban Board & Task Management
- **Workflow Columns:** Default columns provided (`TODO`, `In Progress`, `In Review`, `Done`). Custom column ordering and column updates supported.
- **Task CRUD:** Full support for creating, editing, reassigning, reprioritizing (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and tagging tasks.
- **Backlog Space (`BacklogSpace.tsx`):** Added dedicated backlog area for organizing upcoming tasks prior to sprint board movement.
- **Due Date & Assignee Tracking:** Filter tasks by project, assignee, priority, status, and search keywords.

### 3. 📁 Multi-Project Management
- **Project Workspaces:** Create engineering workspaces with custom project keys (e.g. `TF`, `ENG`), descriptions, member lists, and active status tracking.
- **Progress Tracking:** Automatic calculation of project completion percentage based on associated task statuses.

### 4. 📈 Live Analytics & Workload Insights
- **Interactive Visualizations:** Built with Recharts for real-time sprint velocity, task distribution across statuses, priority breakdown, and individual member workload.
- **Project-Specific Filtering:** Drill down metrics by specific project or view global workspace statistics.

### 5. ⚡ Activity Audit Logging
- **Action Tracing:** Automatic logging of activities across projects, columns, and task changes (created, moved, updated, deleted) with timestamps and user attribution.

### 6. 🛡️ Error Handling, Resiliency & Server Optimization
- **Global Error Boundaries (`ErrorBoundary.tsx`):** Graceful recovery UI for unexpected React client rendering errors.
- **Custom Error Pages:** Designed user-friendly 404 (Not Found) and 500 (Internal Server Error) pages.
- **Vercel In-Memory DB Support:** Optimized data layer with in-memory state fallbacks and seeding to ensure seamless serverless execution without file system write locks.

---

## 🔑 QA Test Accounts & Credentials

The staging environment is pre-seeded with sample accounts for testing both permission tiers:

| Role | Email Address | Password | Permissions / Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `sriramccbp@gmail.com` | `AdminPass@2026` | Full access: Projects, Members, Analytics, Boards, Settings |
| **Member** | `sriramselvaraj799@gmail.com` | `MemberPass@2026` | Member access: Task execution, Kanban board, Project view |

---

## 🧪 Key QA Test Scenarios

### A. Authentication & Session Validation
- [ ] Sign in with valid Admin credentials (`sriramccbp@gmail.com`).
- [ ] Sign in with valid Member credentials (`sriramselvaraj799@gmail.com`).
- [ ] Attempt sign-in with invalid credentials and verify error alerts.
- [ ] Access protected routes directly while unauthenticated (expect redirect to `/auth/signin`).
- [ ] Test logout functionality and verify session revocation.

### B. Kanban Board & Task Operations
- [ ] Create a new task with title, description, priority, assignee, tags, and due date.
- [ ] Drag/move task between `TODO` ➔ `In Progress` ➔ `In Review` ➔ `Done`.
- [ ] Edit task details and verify live update on the board.
- [ ] Filter tasks by search term, priority, and assignee.
- [ ] Move tasks between Backlog and active Board columns.

### C. Projects & RBAC Permissions
- [ ] As Admin, create a new project and assign members.
- [ ] As Member, verify read/write access is restricted to authorized project actions.
- [ ] Check project progress percentage calculation when tasks are completed.

### D. Analytics & Audit Logs
- [ ] Navigate to `/analytics` and verify chart data matches active board tasks.
- [ ] Perform task movements and check that new events appear in the Activity Log.

### E. Responsive Design & Error Handling
- [ ] Test responsive layouts on desktop (1920x1080, 1440x900) and tablet/mobile viewports.
- [ ] Navigate to a non-existent URL (e.g., `/non-existent`) to verify the custom 404 error page.

---

## ⚠️ Known Notes & Testing Considerations

1. **Email Delivery in Staging:** OTP / Reset emails use console logging fallback when SMTP credentials are not configured in environment variables.
2. **Serverless Ephemeral Storage:** On serverless hosting (e.g. Vercel), in-memory seed resets on cold start if persistent database environment variables are not attached.
