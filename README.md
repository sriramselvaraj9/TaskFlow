# TaskFlow ⚡

A modern, high-velocity engineering workspace and internal project management platform built with Next.js, TypeScript, Tailwind CSS, and NextAuth.js.

---

## ✨ Features

- **📊 Interactive Kanban Board**: Create, update, reorder columns, and manage project workflows with drag-and-drop intuition.
- **📁 Multi-Project Management**: Manage multiple engineering projects with dedicated keys, members, and progress metrics.
- **👥 Role-Based Access Control (RBAC)**: Admin and Member roles with distinct permissions for user provisioning and project administration.
- **📧 Automated Email Invitations & Direct Link Fallback**: Provision members with Brevo REST API v3 / SMTP email delivery and instant 1-click invitation link copy.
- **📈 Live Analytics & Workload Insights**: Real-time sprint velocity, task distribution, and completion rates.
- **⚡ Activity Audit Logs**: Comprehensive activity logging for actions across projects, columns, and tasks.
- **🔒 Secure Authentication**: NextAuth.js credential provider integration with bcrypt-hashed credentials and token-based invite activation.

---

## 🚀 Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide React icons
- **State & Data**: TanStack React Query, Zustand, React Hook Form, Zod
- **Auth**: NextAuth.js, bcryptjs
- **Email Delivery**: Brevo REST API v3 (HTTPS Port 443), Nodemailer (SMTP)

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
   Set up your Brevo API key or SMTP settings for live email delivery.

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment & Email Configuration

When deploying TaskFlow to cloud hosting providers (such as **Render**, **Vercel**, **Railway**, or **Docker**), configure the following environment variables in your hosting dashboard:

### Required Environment Variables

```env
# Production App URL (e.g., https://taskflow.onrender.com)
NEXTAUTH_URL=https://your-deployed-app-url.com

# 32+ character secret for JWT sessions
NEXTAUTH_SECRET=your-secure-random-secret-string

# Brevo REST API v3 (Recommended for 100% reliable cloud delivery over HTTPS 443)
BREVO_API_KEY=xkeysib-your_brevo_api_key_here
BREVO_USER=your_verified_sender_email@domain.com
BREVO_FROM="TaskFlow Admin" <your_verified_sender_email@domain.com>
```

> **Why Brevo REST API v3 over SMTP?**  
> Many cloud providers (Render free tier, Vercel Serverless, AWS, DigitalOcean) block or throttle outbound SMTP ports (`25`, `587`). TaskFlow's email service uses Brevo REST API v3 over HTTPS (`port 443`), ensuring instant, firewall-proof email delivery on all platforms.

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
