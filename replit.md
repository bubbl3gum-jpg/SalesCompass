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
- **Settlement Integration**: Settlements can now optionally be linked to active bazars via bazarId field. Settlement modal shows bazar selection when active bazars exist. Settlements list shows bazar indicator badges and supports filtering by bazar type (all/regular/bazar/specific bazar)

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