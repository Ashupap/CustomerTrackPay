# PayTrack - Customer Payment Tracking System

## Overview
PayTrack is a comprehensive customer payment tracking web application designed to help businesses manage customer rentals and recurring payments. It provides an intuitive dashboard-first interface for managing rental payment collections, tracking initial payments, and recurring rental payments on flexible schedules (monthly/quarterly/yearly/one-time). The project aims to streamline payment management and provide clear financial oversight.

## User Preferences
- **Design System**: Material Design with Roboto font family
- **Color Scheme**: Professional blue primary (#3B82F6), subtle backgrounds, clear hierarchy
- **Layout**: Dashboard-first approach, information-dense tables, card-based components
- **Data Storage**: SQLite database with persistent storage

## System Architecture

### Technology Stack
**Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query v5, Shadcn UI, Tailwind CSS, React Hook Form with Zod, date-fns.
**Backend**: Node.js with Express, SQLite with better-sqlite3, Passport.js, Express-session, Scrypt for password hashing, TypeScript.
**Shared**: Zod schemas for validation, Drizzle-zod.

### Data Model
-   **Users**: Authentication and management with role-based access control (admin/user roles). Includes `createdAt` and `createdBy` tracking.
-   **Customers**: Client information linked to users, with multiple purchases. Includes `createdBy` for activity tracking.
-   **Purchases**: Rental transaction records including initial and recurring rental amounts, and frequency. Includes `createdBy` for activity tracking. Automatically generates payment schedules.
-   **Payments**: Individual payment records with amount, due date, and status (paid/upcoming/overdue). Includes `createdBy` and `markedPaidBy` for full audit trail.

### Key Features
-   **Multi-User Support with Role-Based Access Control**: 
    - **Admin Role**: Full system access, can view all customers/transactions, manage users, reset passwords, view activity logs
    - **User Role**: Standard access to their own customers, purchases, and payments
    - Default admin credentials: username `admin`, password `admin123`
-   **Admin Panel** (`/admin`): 
    - User Management: Create, delete users, reset passwords
    - Activity Log: Track all user actions (customer creation, purchase creation, payment marking)
    - All Customers View: Overview of all customers across all users with payment status
-   **Activity Tracking**: Every action (creating customers, purchases, marking payments) is tracked with the user who performed it
-   **Dark Mode**: Full support with system-wide theme toggle and persistence.
-   **Authentication & Security**: Scrypt hashing, session-based authentication, protected routes, minimal login page.
-   **Dashboard**: KPI cards (Total Payments Received, Total Overdue), searchable customer table with status filters and quick payment views. Global "Add Purchase" action and individual quick-add purchase buttons for each customer. Admin users see an "Admin" button to access the admin panel.
-   **Customer Management**: CRUD operations for customers, viewing purchase and payment history.
-   **Purchase & Payment Tracking**: Creation of rental purchases with automated payment schedule generation based on flexible frequencies (monthly/quarterly/yearly/one-time), visual payment timelines, and one-click status updates. Supports both global purchase creation (with customer selection) and customer-specific purchase creation.
-   **Payment Schedule Calculation**: Automated calculation of initial and recurring payments, including overdue detection.
-   **Comprehensive Edit Functionality**: Allows editing of customers, purchases, and payments with security restrictions.
-   **CSV Bulk Customer Import**: Functionality to upload and import customer data from CSV files with validation.
-   **Payment Reminders & Alerts**: Dashboard alerts for upcoming payments and overdue counts.
-   **Timezone Bug Fix**: Corrected payment status calculation to accurately reflect "upcoming" for same-day payments, addressing timezone-related discrepancies.
-   **Mobile-First Design**: Touch-friendly interface with 44px minimum touch targets, responsive button stacking, full-width primary actions on mobile, adaptive text sizing, and icon-only actions on small screens.

### File Structure
The project is organized into `client/` (React frontend), `server/` (Node.js backend), and `shared/` (shared types and validation) directories.

### API Endpoints
Covers authentication, customer management, purchase creation, payment status updates, and KPI retrieval.

### Design Guidelines
Adheres to Material Design principles, Roboto font, consistent spacing, responsive design, and clear status indicators.

## External Dependencies
-   **React**: Frontend library.
-   **Wouter**: Client-side routing.
-   **TanStack Query**: Data fetching and state management.
-   **Shadcn UI**: UI component library.
-   **Tailwind CSS**: Styling framework.
-   **React Hook Form & Zod**: Form management and validation.
-   **date-fns**: Date manipulation utility.
-   **Node.js & Express**: Backend runtime and web framework.
-   **SQLite & better-sqlite3**: Database and SQL client.
-   **Passport.js**: Authentication middleware.
-   **Express-session & better-sqlite3-session-store**: Session management.
-   **Scrypt**: Password hashing.
-   **Playwright**: End-to-end testing.
-   **Vite**: Frontend build tool.
-   **TypeScript**: Language for type safety.
-   **Drizzle-zod**: Schema generation.