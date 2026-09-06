# TaskFlow ⚡

A modern, high-velocity engineering workspace and internal project management platform built with Next.js, TypeScript, Tailwind CSS, and NextAuth.js.

---

## ✨ Features

- **📊 Interactive Kanban Board**: Create, update, reorder columns, and manage project workflows with drag-and-drop intuition.
- **📁 Multi-Project Management**: Manage multiple engineering projects with dedicated keys, members, and progress metrics.
- **👥 Role-Based Access Control (RBAC)**: Admin and Member roles with distinct permissions for user provisioning and project administration.
- **📈 Live Analytics & Workload Insights**: Real-time charts powered by Recharts for sprint velocity, task distribution, and completion rates.
- **⚡ Activity Audit Logs**: Comprehensive activity logging for actions across projects, columns, and tasks.
- **🔒 Secure Authentication**: NextAuth.js credential provider integration with bcrypt-hashed credentials and OTP/reset capabilities.

---

## 🚀 Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide React icons
- **State & Data**: TanStack React Query, Zustand, React Hook Form, Zod
- **Charts**: Recharts
- **Auth**: NextAuth.js, bcryptjs

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
- `npm` or `yarn`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sriramselvaraj9/TaskFlow.git
   cd TaskFlow
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the `.env.example` template:
   ```bash
   cp .env.example .env.local
   ```
   *(Optional)* Configure SMTP settings if you wish to enable live email delivery.

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Default Credentials

The application is pre-seeded with sample accounts for development:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `Admin@gmail.com` | `AdminPass@2026` |
| **Member** | `Member@gmail.com` | `MemberPass@2026` |

---

## 📜 Available Scripts

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run type-check` - Run TypeScript compiler checks
- `npm run biome:check` - Check code formatting and linting with Biome

---

## 📄 License

This project is licensed under the MIT License.
