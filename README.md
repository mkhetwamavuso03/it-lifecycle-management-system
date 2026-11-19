# it-lifecycle-management-system

# 🚀 DevicePulse — Enterprise IT Resource & Device Lifecycle Portal

A high-performance, enterprise-grade hardware and software lifecycle management platform engineered for real-time asset provisioning, automated maintenance scheduling, immutable audit trails, and end-to-end device retirement workflows using the **MEAN stack** (**MongoDB, Express.js, Angular, Node.js**), **TypeScript**, and **Mongoose ODM**.

---

## 🎯 1. The Problem Statement
* **The Core Pain Point:** Enterprise IT operations and asset management teams frequently face unrecorded device allocations, ghost hardware, untracked warranty expirations, and missing security compliance records during offboarding.
* **The Business Impact:** Unmonitored IT assets lead to severe compliance risks, unnecessary procurement expenditures, hardware theft, and expensive administrative overhead during annual software/hardware audits.
* **The Target Persona:** Built for Enterprise IT Directors, System Administrators, Asset Logistics Specialists, and Security Operations Leads.

---

## 💡 2. The Solution Statement
* **The Technical Approach:** DevicePulse delivers a centralized IT lifecycle management hub featuring automated asset status transitions (`PROCURED` ➔ `PROVISIONED` ➔ `MAINTENANCE` ➔ `DECOMMISSIONED`), a decoupled Angular SPA frontend, an Express.js backend API, Mongoose ODM validation, and MongoDB persistence.
* **Core Value Proposition:** Real-time asset lifecycle tracking, automated warranty alert triggers, zero-latency immutable audit logs, and optimized document database queries designed for thousands of managed endpoints.

---

## 🛠️ 3. Tech Stack & Architecture
* **Frontend (`client/`):** Angular 18+ (Standalone Components & Signals SPA) / TypeScript / Tailwind CSS / Angular Material / Lucide Icons / Angular `HttpClient` & RxJS
* **Backend & API (`server/`):** Node.js / Express.js REST APIs / TypeScript / Zod Schema Validation / RESTful Asset Lifecycle Controllers / `bcrypt`
* **Database & Persistence:** MongoDB Atlas / Mongoose ODM / Index-Optimized BSON Document Schemas (`Device`, `Assignment`, `MaintenanceLog`, `AuditLog`, `User`)
* **Security & Auth:** JSON Web Tokens (JWT) / HTTP-only Cookies (`SameSite=None; Secure`) / CORS Policy Enforcement / RBAC Middleware & Angular Route Guards
* **Infrastructure & Tooling:** Monorepo Architecture / Netlify (Frontend CI/CD) / Render (Backend CI/CD) / Git & GitHub Pipelines

---

## 🗺️ 4. System Architecture & Logical Flow

### High-Level Pipeline
```text
Client UI (Angular IT Command Center & Portal — Hosted on Netlify)
      │
      ▼  [HTTPS + HTTP-only Cookie Credentials]
Auth Middleware & RBAC Interceptor (JWT Claims & Role Checking)
      │
      ▼
Express.js REST Controllers & Lifecycle State Engine (Hosted on Render)
      │
      ▼
Mongoose ODM (ACID Transactions, Document Consistency & State Validation)
      │
      ▼
MongoDB Atlas Cluster (Optimized BSON Document Storage)
```

## Admin workspace

The dashboard opens device details in a dialog when an asset tag is selected. IT administrators can manage staff from the **Staff** screen, including creating, editing, and deactivating accounts. Employee IDs are generated automatically when staff accounts are created. Adding a device can optionally assign it to an active staff member; the device status, assignment record, and audit event are committed together.

The seed script creates 22 sample staff accounts and 30 devices across lifecycle states. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SAMPLE_USER_PASSWORD` in the server environment before running `npm run seed`; seeded credentials are not hard-coded.
