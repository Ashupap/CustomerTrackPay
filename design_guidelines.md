# Design Guidelines: Customer Payment Tracking Dashboard

## Design Approach
**Selected System**: Material Design  
**Rationale**: Ideal for data-intensive business applications requiring clear information hierarchy, robust data tables, and professional aesthetic. Material Design provides excellent patterns for dashboards, forms, and data visualization.

## Core Design Principles
1. **Data-First Interface**: Information clarity over decorative elements
2. **Scannable Layouts**: Enable quick assessment of payment status and customer data
3. **Hierarchy Through Structure**: Use elevation, spacing, and typography to guide attention
4. **Professional Efficiency**: Streamlined workflows for adding customers and tracking payments

---

## Typography

**Font Family**: Roboto (via Google Fonts CDN)

**Hierarchy**:
- **Page Titles**: text-3xl, font-medium (Dashboard, Customer Details)
- **Section Headers**: text-xl, font-medium (Customer List, Payment History)
- **KPI Values**: text-4xl, font-bold (large numbers in cards)
- **KPI Labels**: text-sm, font-medium, uppercase, tracking-wide
- **Table Headers**: text-sm, font-semibold, uppercase
- **Body Text**: text-base, font-normal (customer names, descriptions)
- **Secondary Text**: text-sm (emails, dates, metadata)
- **Caption Text**: text-xs (helper text, timestamps)

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, and 8** consistently
- Component padding: p-4 or p-6
- Card spacing: p-6
- Section margins: mb-6 or mb-8
- Element gaps: gap-4 or gap-6
- Page container: px-6 py-8

**Grid System**:
- Dashboard KPI Cards: 2-column grid on desktop (grid-cols-1 md:grid-cols-2)
- Customer table: Full-width with responsive horizontal scroll
- Forms: Single column with max-w-2xl

**Container Strategy**:
- Main content: max-w-7xl mx-auto
- Forms and detail views: max-w-4xl mx-auto
- Full-width tables within container

---

## Component Library

### Authentication
- **Login Card**: Centered card (max-w-md) with elevated shadow, containing logo area, input fields, and primary action button
- **Form Inputs**: Full-width with clear labels above, focus states with border treatment

### Dashboard Layout
- **Top Navigation Bar**: Fixed header with app title, user profile, logout action
- **KPI Card Grid**: 2 prominent cards displaying metrics
  - **Total Payments Received Card**: Large number display with month/year filter dropdown
  - **Total Overdue Card**: Highlighted treatment for attention, large overdue amount
- **Customer Table Section**: Below KPIs, with search/filter controls above table

### KPI Cards
- **Structure**: Elevated cards with rounded corners (rounded-lg)
- **Content Layout**: 
  - Metric label at top (text-sm, uppercase)
  - Large value prominently displayed (text-4xl)
  - Filter controls for applicable metrics (dropdown button group)
  - Subtle icon representing metric type
- **Elevation**: Medium shadow for prominence (shadow-md)

### Data Tables
- **Table Structure**: 
  - Sticky header row with uppercase labels
  - Alternating row treatment for scannability
  - Action column (right-aligned) with edit/view icons
  - Responsive: Horizontal scroll on mobile, full display on desktop
- **Columns**: Customer Name, Company, Product, Next Payment Date, Amount Due, Status Badge, Actions
- **Status Badges**: Small pills with rounded corners - Paid, Upcoming, Overdue states
- **Pagination**: Bottom-aligned with page numbers and next/previous

### Forms
- **Customer Form**: Vertical stack of labeled inputs
  - Text inputs: Name, Email, Phone, Company
  - Product details: Product name, Purchase date (date picker), Price
  - Payment terms: Dropdown (monthly, quarterly, etc.), Initial payment
- **Input Style**: Border treatment with padding (p-3), rounded corners (rounded-md)
- **Button Placement**: Primary action button at bottom, full-width on mobile

### Customer Detail View
- **Header Section**: Customer name, company, contact info in card
- **Purchase Information Card**: Product, date, price, terms displayed in grid
- **Payment Timeline**: Vertical timeline showing all payment dates, amounts, and status
- **Action Bar**: Edit button, back to dashboard link

### Navigation
- **Top Bar**: Horizontal with logo/app name left, user menu right
- **Mobile Menu**: Hamburger icon revealing overlay navigation

---

## Interaction Patterns

### Search & Filter
- **Search Bar**: Prominent placement above customer table, full-width input with search icon
- **Filter Controls**: Dropdown buttons for status filtering (All, Paid, Upcoming, Overdue)

### Empty States
- **No Customers**: Centered message with "Add Customer" call-to-action
- **No Payments**: Clear indication in timeline with contextual help text

### Loading States
- **Table Loading**: Skeleton rows maintaining layout structure
- **KPI Loading**: Animated placeholder in card maintaining height

---

## Responsive Behavior

**Breakpoints**:
- Mobile: Single column layout, stacked KPIs, horizontally scrollable table
- Tablet (md:): 2-column KPI grid, full table visibility
- Desktop (lg:): Optimal spacing, all features visible without scroll

**Mobile Optimizations**:
- Bottom-sheet style forms
- Simplified table with essential columns
- Touch-friendly button sizes (min-h-12)

---

## Animations

**Minimal Motion** - Use sparingly:
- Card hover: Subtle elevation increase
- Button interactions: Simple scale on press
- Page transitions: Instant, no animation
- Loading states: Subtle pulse on skeletons

---

## Images

**No hero image required** - This is a data-focused dashboard application. All visual interest comes from clean layout, typography hierarchy, and organized data presentation.