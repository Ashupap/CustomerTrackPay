# PayTrack - Customer Payment Tracking System

## Overview
PayTrack is a comprehensive customer payment tracking web application designed to help businesses manage customer rentals and recurring payments. Built with a Material Design approach, the application provides an intuitive dashboard-first interface for managing rental payment collections. The system tracks initial payments and recurring rental payments on flexible schedules (monthly/quarterly/yearly/one-time).

## Current State (November 3, 2025)
- **Version**: MVP 1.2 (Rental Payment System)
- **Status**: Fully functional with SQLite persistence
- **Last Updated**: November 3, 2025

## Recent Changes
- **November 3, 2025**: Comprehensive Edit Functionality for Admins
  - Added full edit capabilities for customers, purchases, and payments
  - Customer edit: Reuses customer form with pre-filled data (name, email, phone, company)
  - Purchase edit: Route /customers/:customerId/purchase/:purchaseId/edit with pre-filled form
  - Payment edit: Dialog-based editing for unpaid payments (amount and due date only)
  - Edit buttons added throughout UI:
    - Dashboard: Edit button for each customer row
    - Customer detail: Edit button in header and on each purchase card
    - Payment timeline: Edit button for unpaid payments only
  - Security hardening:
    - Payment edits restricted to amount and dueDate fields only (prevents status/paidDate manipulation)
    - Purchase edits prevent customerId changes (prevents cross-tenant data breaches)
  - Backend routes: PATCH /api/customers/:id, PATCH /api/purchases/:id, PATCH /api/payments/:id
  - All edits properly invalidate TanStack Query cache for UI updates
  - End-to-end testing confirmed all edit operations work securely
- **November 3, 2025**: Rental Payment System Migration
  - Migrated from installment-based to rental-based payment model
  - Purchases now track: initialPayment (upfront), rentalAmount (recurring), rentalFrequency (schedule)
  - Payment generation: 1 initial payment (marked paid) + 12 months of recurring rental payments
  - Updated purchase form UI to collect rental information
  - Fixed dashboard KPI query to use proper URL format (/api/kpi?period=...)
  - Fixed query invalidation to use predicate matching for all KPI queries
  - Database dropped and recreated with new schema (all test data reset)
  - End-to-end testing confirmed system works correctly with new rental model
- **October 27, 2025**: Dark Mode & Login Screen Redesign
  - Implemented full dark mode support with ThemeProvider and localStorage persistence
  - Added theme toggle button (Moon/Sun icons) to both login page and dashboard
  - Completely redesigned login screen with colorful gradient background (purple/pink/orange)
  - Animated blob shapes on login page for visual interest
  - Removed signup/register UI (minimal login-only design)
  - Glassmorphic card effect with backdrop blur
  - All components automatically adapt to light/dark themes
- **October 27, 2025**: Payment Reminders & Alerts Feature
  - Added "Upcoming Payments (Next 7 Days)" alert section to dashboard
  - Implemented overdue payment count badge in KPI card
  - Created API endpoints: GET /api/payments/upcoming and GET /api/payments/overdue-count
  - Dashboard now shows upcoming payments with customer name (clickable), product, due date, and amount
  - Blue-styled alert card for upcoming payments with hover effects
  - Automatic filtering excludes overdue payments from upcoming section
- **October 27, 2025**: CSV Bulk Customer Import
  - Added CSV file upload functionality to dashboard
  - Auto-delimiter detection supports comma, semicolon, tab-delimited files
  - Flexible column mapping (name/customer_name, email, phone, company)
  - Row-level validation with detailed error reporting
  - Import results dialog shows total/success/failed counts with error details
- **October 27, 2025**: SQLite Database Migration
  - Migrated from in-memory storage to SQLite for data persistence
  - Database file: ./paytrack.db
  - Foreign key constraints with CASCADE DELETE
  - Session persistence using better-sqlite3-session-store
  - All data now survives server restarts
- **October 27, 2025**: Initial MVP implementation completed
  - Custom authentication system with username/password
  - Dashboard with KPI cards (Total Payments Received, Total Overdue Amounts)
  - Customer CRUD operations
  - Purchase tracking with automatic payment schedule generation
  - Payment status management (paid, upcoming, overdue)
  - Comprehensive end-to-end testing completed successfully

## User Preferences
- **Design System**: Material Design with Roboto font family
- **Color Scheme**: Professional blue primary (#3B82F6), subtle backgrounds, clear hierarchy
- **Layout**: Dashboard-first approach, information-dense tables, card-based components
- **Data Storage**: SQLite database with persistent storage

## Project Architecture

### Technology Stack
**Frontend**:
- React 18 with TypeScript
- Wouter for routing
- TanStack Query v5 for data fetching and state management
- Shadcn UI components (Material Design approach)
- Tailwind CSS for styling
- React Hook Form with Zod validation
- date-fns for date manipulation

**Backend**:
- Node.js with Express
- SQLite with better-sqlite3
- Passport.js with Local Strategy for authentication
- Express-session with better-sqlite3-session-store
- Scrypt for password hashing
- TypeScript for type safety

**Shared**:
- Zod schemas for validation
- Drizzle-zod for schema generation
- Unified type definitions across frontend and backend

### Data Model
**Core Entities**:
1. **Users**: Authentication and user management
   - id (UUID), username (unique), password (hashed)

2. **Customers**: Client information
   - id, userId, name, email, phone, company, createdAt
   - Belongs to a user, has many purchases

3. **Purchases**: Rental transaction records
   - id, customerId, product, purchaseDate, initialPayment, rentalAmount, rentalFrequency, createdAt
   - Rental frequencies: monthly, quarterly, yearly, one-time
   - Automatically generates payment schedule on creation:
     - 1 initial payment (marked as paid)
     - Monthly: 12 recurring payments
     - Quarterly: 4 recurring payments
     - Yearly: 3 recurring payments
     - One-time: 1 rental payment

4. **Payments**: Individual payment records
   - id, purchaseId, amount, dueDate, status (paid/upcoming/overdue), paidDate, createdAt
   - Status automatically calculated based on due date and payment state

### Key Features

#### Dark Mode
- Full dark mode support with system-wide theme toggle
- Theme persists in localStorage across sessions
- Smooth transitions between light and dark modes
- All components automatically adapt to current theme
- Theme toggle accessible on both login page and dashboard
- No theme flash on page load (uses useLayoutEffect)

#### Authentication & Security
- Secure password hashing using scrypt
- Session-based authentication with express-session
- Protected routes requiring authentication
- Minimum 6-character password requirement
- Username trimming and validation
- Password data never exposed in API responses
- Colorful, minimal login page with animated gradient background
- No signup UI (backend registration endpoint still available for admin use)

#### Dashboard
- **KPI Cards**:
  - Total Payments Received (filterable by All Time, This Year, This Month)
  - Total Overdue Amounts with alert styling
- **Customer Table**:
  - Search by customer name, company, or email
  - Filter by status (All, With Upcoming, With Overdue)
  - Quick view of next payment dates and amounts
  - Overdue badges for at-risk accounts
  - Direct navigation to customer details

#### Customer Management
- Add/edit customer information (name, company, email, phone)
- View complete purchase and payment history
- Add multiple purchases per customer
- Track payment timelines visually

#### Purchase & Payment Tracking
- Create rental purchases with initial payment + recurring rental amounts
- Flexible rental frequency (monthly/quarterly/yearly/one-time)
- Automatic payment schedule generation based on rental frequency
- Visual payment timeline with status indicators
- One-click payment status updates
- Initial payment automatically marked as paid

#### Payment Schedule Calculation (Rental Model)
- **Initial Payment**: Always marked as paid on purchase date
- **Monthly Rentals**: 12 recurring payments (one per month)
- **Quarterly Rentals**: 4 recurring payments (one per quarter)
- **Yearly Rentals**: 3 recurring payments (one per year)
- **One-time Rentals**: 1 rental payment on purchase date
- Automatic overdue detection based on due dates

### File Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                    # Shadcn UI components
│   │   │   ├── theme-provider.tsx     # Dark mode context provider
│   │   │   └── theme-toggle.tsx       # Theme toggle button
│   │   ├── hooks/
│   │   │   └── use-auth.tsx      # Authentication hook
│   │   ├── lib/
│   │   │   ├── protected-route.tsx  # Route protection
│   │   │   └── queryClient.ts    # TanStack Query setup
│   │   ├── pages/
│   │   │   ├── auth-page.tsx          # Login page (colorful, minimal)
│   │   │   ├── dashboard-page.tsx     # Main dashboard
│   │   │   ├── customer-detail-page.tsx
│   │   │   ├── customer-form-page.tsx
│   │   │   └── purchase-form-page.tsx
│   │   ├── App.tsx               # Router configuration with ThemeProvider
│   │   └── index.css             # Global styles, dark mode variables, animations
│   └── index.html
├── server/
│   ├── auth.ts                   # Authentication setup
│   ├── routes.ts                 # API endpoints
│   ├── storage.ts                # Data storage layer
│   └── index.ts                  # Express server
└── shared/
    └── schema.ts                 # Shared types and validation
```

### API Endpoints

**Authentication**:
- `POST /api/register` - Create new user account
- `POST /api/login` - Authenticate user
- `POST /api/logout` - End session
- `GET /api/user` - Get current user

**Customers**:
- `GET /api/customers` - List all customers with summary data
- `GET /api/customers/:id` - Get customer with purchases and payments
- `POST /api/customers` - Create new customer
- `PATCH /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

**Purchases**:
- `POST /api/purchases` - Create purchase (auto-generates payments)

**Payments**:
- `PATCH /api/payments/:id/mark-paid` - Mark payment as paid

**KPIs**:
- `GET /api/kpi?period=all|month|year` - Get payment statistics

### Design Guidelines
- Material Design principles
- Roboto font family for professional appearance
- Consistent spacing (4, 6, 8 unit system)
- Shadow-md for elevated cards
- Uppercase tracking-wide labels
- Responsive design (mobile-first)
- Loading states with skeleton components
- Empty states with call-to-action buttons
- Clear status indicators (badges for paid/overdue/upcoming)

### Testing
- Comprehensive end-to-end testing with Playwright
- Test coverage includes:
  - User registration and login
  - Customer CRUD operations
  - Purchase creation with payment schedules
  - Payment status updates
  - Data persistence across sessions
  - KPI calculations and filtering

## Database Maintenance
- **Database File**: ./paytrack.db (SQLite database file)
- **Backup**: Regularly copy paytrack.db file to backup location
- **Foreign Keys**: Enabled with CASCADE DELETE - deleting a customer removes all associated purchases and payments
- **WAL Mode**: Write-Ahead Logging enabled for better concurrency and performance

## Known Items
1. **KPI "This Month" filter edge case**: Payments marked as paid on the current day may show $0 due to date range filtering logic
2. **Rental schedule configuration**: Payment counts are currently hardcoded (12 monthly, 4 quarterly, 3 yearly) - could be made configurable
3. **Query invalidation**: Uses predicate matching for KPI queries to ensure proper cache invalidation across different period filters

## Next Phase Ideas
- Add bulk customer import via CSV
- Implement payment reminders and notifications
- Create detailed analytics and reporting with charts
- Add export functionality (PDF, Excel)
- Implement role-based access control for teams
- Add custom payment schedule configuration
- Email integration for payment reminders
- Payment receipt generation

## Environment Variables
- `SESSION_SECRET`: Required for session management (automatically provided by Replit)
- `PORT`: Server port (defaults to 5000)
- `NODE_ENV`: Environment mode (development/production)

## Running the Application
The application runs via the "Start application" workflow:
```bash
npm run dev
```
This starts both the Express backend and Vite frontend on port 5000.

## Development Notes
- All routes prefixed with `/api` for backend
- Frontend uses `apiRequest` helper from `@lib/queryClient` for API calls
- TanStack Query handles caching and state management
- Protected routes redirect to `/auth` if not authenticated
- Form validation uses Zod schemas from `shared/schema.ts`
- Data-testid attributes on interactive elements for testing
