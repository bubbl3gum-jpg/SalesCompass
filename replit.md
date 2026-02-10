# SalesStock Management System

## Overview

This is a comprehensive Live Sales Recap & Stock management system built with modern web technologies. The application provides real-time inventory tracking, complex pricing logic, role-based access control (RBAC), and complete sales management capabilities. It's designed for retail operations that require detailed sales reporting, stock management, and multi-store coordination.

The system supports 6 different user roles (SPG, Supervisor, Stockist, Sales Administrator, Finance, System Administrator) with specific permissions and access levels. It includes sophisticated price resolution logic, transfer order management, settlement processing, and comprehensive reporting features.

**Recent Architecture Change (September 1, 2025)**: Completely transitioned from opening stock-based inventory tracking to a transfers-only system. All opening stock functionality has been removed from the frontend, backend, database schema, and user permissions. Stock levels are now determined exclusively through transfer orders between stores.

**Critical Bug Fixes (September 14, 2025)**:
- **Authorization Fix**: Added 'System Administrator' to sales endpoint allowed roles in server/routes.ts. System Administrator users can now record sales without 403 authorization errors.
- **Frontend Routing Fix**: Fixed React Query cache synchronization issue in useStoreAuth.tsx by adding query invalidation after login success. Users now properly redirect to dashboard after login instead of getting 404 errors.
- **Comprehensive Testing**: End-to-end tests confirm both authentication and sales recording functionality work correctly for all user roles including System Administrator.

**Bazar Management (February 2026)**:
- **Database Schema**: Added `bazars` table with fields: bazarId, bazarName, location, startDate, endDate, status (upcoming/active/ended), createdAt, updatedAt
- **API Routes**: Full CRUD endpoints at `/api/bazars` with admin-only access for mutations
- **Frontend**: New Bazars management page at `/bazars` under Administration section in sidebar
- **Status Control**: Admin-controlled status (upcoming, active, ended)
- **Settlement Integration**: Settlements can now optionally be linked to active bazars via bazarId field. Settlement modal allows choosing between "Store Settlement" or "Bazar Settlement" - selecting bazar hides the store dropdown. Settlements list shows bazar indicator badges and supports filtering by bazar type (all/regular/bazar/specific bazar)
- **EDC Payments**: Settlement modal now includes EDC payment section where users can add multiple card/bank payments. EDC options come from the payment methods configured in Admin Settings. EDC totals are displayed in the settlements list table alongside cash amounts
- **Recurring Bazars**: Bazars can occur multiple times at the same location with different date ranges. Each occurrence is a separate record with its own revenue tracking. Timestamps (startDate/endDate) differentiate instances, not location.
- **Bazar History View**: Toggle between Grid and History views. History view groups bazars by location, showing all occurrences with individual and total revenue per location.
- **Repeat Bazar**: Ended bazars have a "Repeat" button that pre-fills a new bazar form with the same name and location but new dates, making it easy to create recurring events.

**Store Configuration (February 2026)**:
- **Centralized Store Config**: New "Store Configuration" page under Administration centralizes all per-store settings
- **Schema Update**: Added `storeType` and `storeCategory` (normal/bazar) fields to stores table
- **Store Type**: Identifies the department store (e.g., Sogo, Matahari, Metro) or "Independent" for standalone stores. Used to track which department store owns the borrowed EDC machines for payment reconciliation.
- **Store Category**: Normal = regular retail store; Bazar = event-based store with daily settlement tracking
- **Payment Methods (formerly EDC Machines)**: Admin can assign/remove payment methods per store from the config page. Each payment method has: Bank (financial institution name), Payment Type (EDC/QRIS/Debit/Credit/Transfer dropdown), EDC Key (terminal/merchant ID for identifying specific machines), and Admin Fee (% charged by bank). Payment methods are store-specific - only methods configured for a store appear in that store's sales entry and settlement forms.
- **Discount Assignments**: Admin can assign/remove specific discounts per store from the config page
- **API Routes**: GET/PATCH /api/store-config, GET /api/store-config/:kodeGudang, GET /api/store-edc/:kodeGudang, POST/DELETE /api/store-edc, plus existing store-discounts endpoints
- **Permissions**: `store:config` permission for System Administrator (full control) and Supervisor (read-only, scoped to their store)
- **Sales Entry Payment**: Payment method dropdown shows only store-specific methods (from store_edc) plus Cash. Department store indicator shown when store type is not Independent.
- **Settlement Payment**: Settlement modal shows store-specific payment methods for non-cash entries. Department store badge displayed when applicable.
- **Discounts Page**: Simplified to only show discount types CRUD; store assignments moved to Store Configuration page
- **Virtual Inventory Tab**: Store Configuration now includes a Virtual Store Inventory section showing per-store inventory with search, add, delete, and file import
- **Sidebar Cleanup**: Bazars and Virtual Store Inventory removed from sidebar navigation (data/routes remain intact)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for client-side routing with role-based route protection
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables for theming
- **Build Tool**: Vite for fast development and optimized production builds
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript throughout for type consistency
- **API Design**: RESTful API with structured error handling and logging middleware
- **Authentication**: OpenID Connect integration with Replit Auth using Passport.js
- **Session Management**: Express sessions with PostgreSQL storage using connect-pg-simple
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle migrations with shared schema definitions

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **Schema**: Comprehensive schema covering users, stores, inventory, sales, settlements, pricing, and transfers
- **Key Tables**: 
  - User management with role-based permissions
  - Reference sheet for item master data
  - Complex pricing structure with multiple resolution strategies
  - Stock ledger for inventory tracking
  - Sales transactions with settlement processing
  - Transfer orders for inter-store movements

### Authentication & Authorization
- **Provider**: Replit Auth with OpenID Connect protocol
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **RBAC Implementation**: Role-based access control with 6 distinct user roles
- **Route Protection**: Frontend route guards based on authentication status
- **API Security**: Middleware-based authentication checks for protected endpoints

### Business Logic Architecture
- **Price Resolution**: Multi-tier pricing logic (serial number → item code → best match → generic)
- **Inventory Management**: Real-time stock tracking with transfer order processing
- **Settlement System**: Daily settlement processing with reconciliation capabilities
- **Discount Engine**: Flexible discount system supporting multiple discount types
- **Stock Operations**: Comprehensive stock ledger with opening stock management

### Development & Deployment
- **Development**: Hot module replacement with Vite dev server
- **Production Build**: Optimized client bundle with server-side rendering support
- **Environment**: Replit-optimized with runtime error overlay and cartographer integration
- **Database Provisioning**: Automated database setup with migration support

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Session Storage**: PostgreSQL-based session storage for authentication persistence

### Authentication Services
- **Replit Auth**: OpenID Connect authentication provider
- **Passport.js**: Authentication middleware with OpenID Connect strategy

### UI & Design System
- **Radix UI**: Headless UI components for accessibility and customization
- **Lucide React**: Icon library for consistent iconography
- **Google Fonts**: Inter font family for typography
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens

### Development Tools
- **TypeScript**: Type checking and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer for browser compatibility
- **Replit Runtime**: Development environment integration and error handling

### Core Libraries
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form management with validation
- **Zod**: Schema validation for type-safe data handling
- **Date-fns**: Date manipulation and formatting utilities
- **Class Variance Authority**: Type-safe CSS-in-JS styling utilities