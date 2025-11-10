# PayTrack Features

## Overview
PayTrack is a comprehensive customer payment tracking system designed for businesses that manage rental payments and recurring customer transactions. This document provides a complete overview of all features available in the application.

---

## 1. Authentication & Security

### User Authentication
- **Secure Login System**: Custom authentication using username and password
- **Password Security**: Scrypt hashing algorithm for secure password storage
- **Session Management**: Persistent sessions using SQLite-backed session store
- **Protected Routes**: All application routes require authentication
- **Manual Logout**: Secure logout functionality to end user sessions

### Security Features
- **Data Isolation**: Users can only access their own customer and payment data
- **Edit Restrictions**: Payment edits restricted to prevent status manipulation
- **Cross-Tenant Protection**: Purchase edits prevent customer ID changes to avoid data breaches
- **Session Security**: Server-side session management with secure cookie storage

---

## 2. Dashboard & Analytics

### Key Performance Indicators (KPIs)
- **Total Payments Received**: Track all collected payments with time-based filtering
  - Filter by: All Time, This Month, This Year
  - Displays total amount with currency formatting
  - Shows number of paid payments

- **Total Overdue Amount**: Monitor outstanding payments requiring attention
  - Displays total overdue amount in red for visibility
  - Shows count of overdue payments
  - Includes alert icon for urgent attention

### Payment Alert Sections

#### This Month's Upcoming Payments
- Displays all unpaid payments due within the current month
- Shows for each payment:
  - Customer name (clickable link to customer details)
  - Company name
  - Email address
  - Phone number
  - Payment amount
  - Due date
- Sorted by due date (earliest first)
- Blue-styled card for visual distinction

#### Overdue Payments
- Lists all payments past their due date that remain unpaid
- Shows for each payment:
  - Customer name (clickable link)
  - Company name
  - Email and phone contact information
  - Payment amount
  - How long overdue (e.g., "Overdue since: Nov 3, 2025")
- Red-styled alert card for urgency
- Sorted by due date

### Customer Table
- **Search Functionality**: Real-time search by customer name, company, or email
- **Status Filtering**: Filter customers by "All Customers", "Has Overdue", or "Fully Paid"
- **Column Display**:
  - Customer name
  - Company name
  - Contact information (email, phone)
  - Next payment date and amount
  - Total overdue amount (highlighted in red if applicable)
  - Quick action buttons

### Quick Actions
- **Add Customer**: Quick access button from dashboard
- **Import CSV**: Bulk customer import functionality
- **Edit Customer**: Direct edit access from dashboard table

---

## 3. Customer Management

### Create Customer
- **Form Fields**:
  - Name (required)
  - Email address (required, validated format)
  - Phone number (optional)
  - Company name (optional)
- **Validation**: Real-time form validation with error messages
- **Auto-redirect**: Automatically navigates to customer detail page after creation

### View Customer Details
- **Customer Information Card**: Displays all customer details with icons
- **Purchase History**: Complete list of all purchases for the customer
- **Payment Timeline**: Visual timeline of all payments across all purchases
- **Financial Summary**: Quick view of next payment and overdue amounts

### Edit Customer
- **In-line Editing**: Edit customer information from dashboard or detail page
- **Form Pre-population**: All existing data pre-filled for easy updates
- **Validation**: Same validation rules as customer creation
- **Instant Updates**: Changes reflected immediately across all views

### Delete Customer
- **Cascade Delete**: Automatically removes all associated purchases and payments
- **Confirmation**: (Could be added for safety)
- **Data Integrity**: Maintains foreign key constraints

---

## 4. Purchase & Payment Tracking

### Rental-Based Payment Model
PayTrack uses a rental payment model where customers make:
1. **Initial Payment**: One-time upfront payment (can be $0)
2. **Recurring Rental Payments**: Regular payments based on selected frequency

### Create Purchase
- **Product/Service Name**: Description of what's being rented
- **Purchase Date**: Date the rental agreement starts
- **Initial Payment**: Upfront amount (optional, can be $0)
- **Rental Amount**: Recurring payment amount
- **Rental Frequency Options**:
  - **Monthly**: Generates 12 monthly payments
  - **Quarterly**: Generates 4 quarterly payments
  - **Yearly**: Generates 3 yearly payments
  - **One-time**: Generates a single rental payment

### Automatic Payment Schedule Generation
- **Initial Payment**: Automatically marked as "Paid" on purchase date
- **Recurring Payments**: Automatically generated based on frequency
  - Monthly: 12 payments, 30 days apart
  - Quarterly: 4 payments, 90 days apart
  - Yearly: 3 payments, 365 days apart
  - One-time: 1 payment on purchase date
- **Status Calculation**: Automatic status assignment (Paid/Upcoming/Overdue)
- **Date Intelligence**: Uses local timezone for accurate due date tracking

### Edit Purchase
- **Modify Details**: Edit product name, dates, amounts, and frequency
- **Route Protection**: Cannot change which customer owns the purchase
- **Payment Recalculation**: (Note: Currently doesn't regenerate payment schedule on edit)
- **Access Control**: Edit buttons available on customer detail page

### Payment Timeline View
- **Visual Timeline**: Chronological display of all payments for a purchase
- **Payment Cards**: Each payment shows:
  - Payment number
  - Amount
  - Due date
  - Payment status (Paid/Upcoming/Overdue)
  - Paid date (if applicable)
- **Color Coding**:
  - Green badge for "Paid"
  - Gray badge for "Upcoming"
  - Red badge for "Overdue"

### Payment Status Management
- **Mark as Paid**: One-click button to mark upcoming/overdue payments as paid
  - Automatically sets paid date to current date
  - Updates status to "Paid"
  - Instantly updates all dashboard KPIs
- **Edit Payment**: Dialog-based editing for unpaid payments
  - Modify payment amount
  - Change due date
  - Cannot edit status or paid date (security restriction)
- **Automatic Status Updates**: Status recalculated based on:
  - Current date vs. due date
  - Payment completion status

### Payment Status Logic
- **Paid**: Payment has been completed (paidDate is set)
- **Upcoming**: Payment due date is today or in the future
- **Overdue**: Payment due date is in the past and not yet paid
- **Timezone Accuracy**: Uses `startOfDay()` normalization to prevent same-day payments from appearing as overdue

---

## 5. Bulk Import & Data Management

### CSV Customer Import
- **File Upload**: Click to select and upload CSV files
- **Flexible Format Support**:
  - Comma-delimited (,)
  - Semicolon-delimited (;)
  - Tab-delimited
  - Auto-detection of delimiter

### Column Mapping
Automatically recognizes column headers:
- `name` or `customer_name` → Customer Name
- `email` → Email Address
- `phone` → Phone Number
- `company` → Company Name

### Import Validation
- **Row-by-row Validation**: Each record validated individually
- **Email Format Validation**: Ensures valid email format
- **Required Fields Check**: Name and email must be present
- **Error Reporting**: Detailed error messages for failed rows
- **Partial Import**: Successfully validated rows imported even if some fail

### Import Results Dialog
- **Success Summary**: Count of successfully imported customers
- **Failure Details**: List of failed rows with specific error messages
- **Row Numbers**: Shows which rows failed and why
- **Instant Refresh**: Customer list updates automatically after import

---

## 6. User Interface & Experience

### Dark Mode
- **Theme Toggle**: Moon/Sun icon in header for easy switching
- **Persistent Setting**: Theme preference saved to localStorage
- **System-wide Application**: All components adapt to selected theme
- **Smooth Transitions**: Seamless color transitions between themes
- **Login Page Support**: Dark mode available even on authentication screen

### Design System
- **Material Design**: Clean, professional aesthetic
- **Roboto Font Family**: Consistent typography throughout
- **Professional Color Scheme**:
  - Primary Blue: #3B82F6
  - Subtle backgrounds and borders
  - Clear visual hierarchy
- **Responsive Layout**: Works on desktop and tablet devices
- **Card-based Components**: Clean, organized information presentation

### Navigation
- **Dashboard-First**: Main landing page with comprehensive overview
- **Breadcrumb Navigation**: Easy return to previous pages
- **Clickable Links**: Customer names link to detail pages
- **Back Buttons**: Consistent navigation patterns

### Interactive Elements
- **Hover Effects**: Subtle elevation on cards and buttons
- **Loading States**: Skeleton loaders during data fetching
- **Toast Notifications**: Success and error messages
- **Form Validation**: Real-time validation with clear error messages
- **Disabled States**: Clear indication when actions unavailable

### Data Display
- **Currency Formatting**: Automatic $ prefix and decimal formatting
- **Date Formatting**: Human-readable date displays (e.g., "Nov 3, 2025")
- **Status Badges**: Color-coded visual indicators
- **Empty States**: Helpful messages when no data available
- **Search Highlighting**: (Can be added for better UX)

---

## 7. Data Persistence & Performance

### Database
- **SQLite Storage**: All data persisted to local database file
- **Session Storage**: Login sessions survive server restarts
- **Foreign Key Constraints**: Automatic cascade deletion for data integrity
- **Indexed Queries**: Optimized database queries for performance

### Real-time Updates
- **TanStack Query Cache**: Intelligent data caching and synchronization
- **Automatic Invalidation**: UI updates instantly after mutations
- **Optimistic Updates**: (Can be implemented for better UX)
- **Background Refetching**: Keeps data fresh

### Data Integrity
- **Validation Layer**: Zod schemas ensure data consistency
- **Type Safety**: TypeScript across entire stack
- **Foreign Key Constraints**: Database-level referential integrity
- **Error Handling**: Graceful error messages and recovery

---

## 8. API Features

### Authentication Endpoints
- `POST /api/register` - Create new user account
- `POST /api/login` - Authenticate user
- `POST /api/logout` - End user session
- `GET /api/user` - Get current user information

### Customer Endpoints
- `GET /api/customers` - List all customers for authenticated user
- `GET /api/customers/:id` - Get customer details with purchases and payments
- `POST /api/customers` - Create new customer
- `PATCH /api/customers/:id` - Update customer information
- `DELETE /api/customers/:id` - Delete customer (cascade)
- `POST /api/customers/bulk-import` - Bulk import from CSV

### Purchase Endpoints
- `POST /api/purchases` - Create purchase with automatic payment generation
- `PATCH /api/purchases/:id` - Update purchase details
- `DELETE /api/purchases/:id` - Delete purchase (cascade)

### Payment Endpoints
- `GET /api/payments/this-month-upcoming` - Get upcoming payments for current month
- `GET /api/payments/overdue` - Get all overdue payments
- `GET /api/payments/overdue-count` - Get count of overdue payments
- `PATCH /api/payments/:id` - Update payment amount/due date
- `PATCH /api/payments/:id/mark-paid` - Mark payment as paid

### Analytics Endpoints
- `GET /api/kpi` - Get KPI data (total paid, total overdue)
- `GET /api/kpi?period=month` - KPI filtered by month
- `GET /api/kpi?period=year` - KPI filtered by year

---

## 9. Security & Access Control

### Authentication Security
- **Scrypt Password Hashing**: Industry-standard password protection
- **Session-based Authentication**: Secure, server-side session management
- **Protected API Routes**: All endpoints require authentication
- **Manual Logout**: Explicit logout endpoint to end user sessions

### Data Access Control
- **User Isolation**: Users can only access their own data
- **Foreign Key Enforcement**: Database-level access control
- **Query Filtering**: All queries filtered by authenticated user ID

### Edit Restrictions
- **Payment Edit Security**: Cannot modify status or paidDate directly
- **Purchase Edit Security**: Cannot change customerId to prevent data theft
- **Validation**: Server-side validation on all mutations

---

## 10. Quality Assurance & Bug Fixes

### Manual Testing & Validation
- **User Flow Testing**: Complete workflow validation performed manually
- **Payment Status Testing**: Verified timezone bug fixes
- **CRUD Operations**: All create, read, update, delete operations tested

### Bug Fixes & Improvements
- **Timezone Bug Fix (Nov 3, 2025)**: Same-day payments now correctly show as "upcoming"
- **Query Optimization**: Efficient database queries with proper indexing
- **Cache Invalidation**: Proper TanStack Query invalidation patterns
- **Error Handling**: Graceful error messages throughout application

---

## 11. Future Enhancement Opportunities

While PayTrack is fully functional, here are potential enhancements:

### Reporting
- Export payment history to PDF
- Generate monthly/quarterly financial reports
- Payment trend analysis and charts

### Notifications
- Email reminders for upcoming payments
- Overdue payment alerts
- Payment confirmation emails

### Advanced Features
- Partial payment support
- Payment history notes/comments
- Custom payment schedules
- Multi-currency support
- Payment method tracking
- Receipt generation

### User Management
- Multi-user support with roles
- Team collaboration features
- Audit logs

### Integrations
- Payment gateway integration (Stripe, PayPal)
- Accounting software exports
- SMS notifications

---

## Technical Specifications

### Performance
- **Fast Load Times**: Optimized queries and caching
- **Real-time Updates**: Instant UI refresh after mutations
- **Efficient Rendering**: React best practices and memoization

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for tablets
- Mobile-friendly interface

### Data Limits
- **Customers**: Unlimited
- **Purchases**: Unlimited per customer
- **Payments**: Automatically generated based on purchase frequency
- **Database**: SQLite file size limits (typically terabytes)

---

## Getting Started

### Default Admin Account
- **Username**: admin
- **Password**: admin123
- (Change these credentials after first login in production)

### Quick Start Guide
1. Log in with admin credentials
2. Add your first customer using the "Add Customer" button
3. Create a purchase for the customer with rental details
4. View automatically generated payment schedule
5. Mark payments as paid as they are received
6. Monitor dashboard for upcoming and overdue payments

---

## Support & Documentation

### Additional Resources
- `replit.md` - Technical architecture and development guidelines
- API documentation via code comments
- TypeScript types for full IDE support
- Inline form validation messages

### Best Practices
- Regularly review overdue payments section
- Use CSV import for bulk customer additions
- Set appropriate rental frequencies for your business model
- Monitor KPI cards for financial oversight
- Use search and filters to find specific customers quickly

---

*Last Updated: November 3, 2025*
*Version: MVP 1.2 (Rental Payment System)*
