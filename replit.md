# PayTrack - Customer Payment Tracking System

## Overview
PayTrack is a comprehensive customer payment tracking web application designed to help businesses manage customer purchases, monitor payment schedules, and track receivables. Built with a Material Design approach, the application provides an intuitive dashboard-first interface for managing payment collections.

## Current State (October 27, 2025)
- **Version**: MVP 1.1
- **Status**: Fully functional with SQLite persistence
- **Last Updated**: October 27, 2025

## Recent Changes
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

3. **Purchases**: Transaction records
   - id, customerId, product, purchaseDate, totalPrice, paymentTerms, initialPayment, createdAt
   - Payment terms: one-time, monthly (6 installments), quarterly (4 installments), yearly (3 installments)
   - Automatically generates payment schedule on creation

4. **Payments**: Individual payment records
   - id, purchaseId, amount, dueDate, status (paid/upcoming/overdue), paidDate, createdAt
   - Status automatically calculated based on due date and payment state

### Key Features

#### Authentication & Security
- Secure password hashing using scrypt
- Session-based authentication with express-session
- Protected routes requiring authentication
- Minimum 6-character password requirement
- Username trimming and validation
- Password data never exposed in API responses

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
- Create purchases with flexible payment terms
- Automatic payment schedule generation based on terms
- Visual payment timeline with status indicators
- One-click payment status updates
- Initial payment support (down payment)

#### Payment Schedule Calculation
- **One-time**: Single payment equal to total price
- **Monthly**: 6 equal monthly installments
- **Quarterly**: 4 equal quarterly installments
- **Yearly**: 3 equal yearly installments
- Initial payment counted separately and marked as paid
- Automatic overdue detection based on due dates

### File Structure
```
├── client/
│   ├── src/
│   │   ├── components/ui/        # Shadcn UI components
│   │   ├── hooks/
│   │   │   └── use-auth.tsx      # Authentication hook
│   │   ├── lib/
│   │   │   ├── protected-route.tsx  # Route protection
│   │   │   └── queryClient.ts    # TanStack Query setup
│   │   ├── pages/
│   │   │   ├── auth-page.tsx          # Login/Register
│   │   │   ├── dashboard-page.tsx     # Main dashboard
│   │   │   ├── customer-detail-page.tsx
│   │   │   ├── customer-form-page.tsx
│   │   │   └── purchase-form-page.tsx
│   │   ├── App.tsx               # Router configuration
│   │   └── index.css             # Global styles & design tokens
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
2. **Payment schedule configuration**: Installment counts are currently hardcoded (6 for monthly, 4 for quarterly, 3 for yearly) - could be made configurable

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
