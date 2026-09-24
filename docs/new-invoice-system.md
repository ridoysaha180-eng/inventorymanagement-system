# Project-Based Invoice System Architecture

This document outlines the complete architecture, database schema, API structure, and UI layout for the new professional, scalable, and project-based invoice system.

## 1. Database Schema (Normalized & Professional)

The database is designed to be fully normalized, ensuring data integrity and scalability.

```sql
-- 1. Clients Table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    company_name VARCHAR(255),
    tax_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    billing_type VARCHAR(50) CHECK (billing_type IN ('fixed', 'hourly', 'milestone')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Invoices Table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL, -- e.g., INV-2026-0001
    milestone_name VARCHAR(255), -- Optional, if milestone-based
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
    terms_conditions TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoice Items Table
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0.00, -- e.g., 15.00 for 15%
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL, -- (quantity * unit_price) - discount + tax
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(100) NOT NULL, -- e.g., 'Bank Transfer', 'Credit Card', 'Cash'
    transaction_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 2. API Structure (RESTful)

The API is designed to be modular and resource-oriented.

### Clients API
- `GET /api/v1/clients` - List all clients
- `POST /api/v1/clients` - Create a new client
- `GET /api/v1/clients/:id` - Get client details
- `PUT /api/v1/clients/:id` - Update client
- `DELETE /api/v1/clients/:id` - Delete client

### Projects API
- `GET /api/v1/projects` - List all projects
- `POST /api/v1/projects` - Create a new project
- `GET /api/v1/projects/:id` - Get project details (includes related invoices)
- `PUT /api/v1/projects/:id` - Update project

### Invoices API
- `GET /api/v1/invoices` - List all invoices (with filters: status, project_id, client_id)
- `POST /api/v1/invoices` - Create a new invoice (generates `invoice_number` automatically)
- `GET /api/v1/invoices/:id` - Get invoice details (includes items and payments)
- `PUT /api/v1/invoices/:id` - Update invoice (only if draft)
- `POST /api/v1/invoices/:id/send` - Mark invoice as sent
- `GET /api/v1/invoices/:id/pdf` - Generate and download PDF

### Payments API
- `POST /api/v1/invoices/:id/payments` - Record a new payment (auto-updates invoice status)
- `GET /api/v1/invoices/:id/payments` - List payments for an invoice

## 3. Sample Controller Logic (Node.js / Express)

Example of recording a payment and auto-updating the invoice status.

```javascript
// controllers/paymentController.js
const db = require('../db'); // Assume a configured database client

exports.recordPayment = async (req, res) => {
    const { invoice_id } = req.params;
    const { amount, payment_date, payment_method, transaction_reference } = req.body;

    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Insert the payment record
        const paymentResult = await client.query(
            `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, transaction_reference) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [invoice_id, amount, payment_date, payment_method, transaction_reference]
        );

        // 2. Get current invoice totals
        const invoiceResult = await client.query(
            `SELECT grand_total, amount_paid FROM invoices WHERE id = $1 FOR UPDATE`,
            [invoice_id]
        );
        
        if (invoiceResult.rows.length === 0) throw new Error('Invoice not found');
        
        const invoice = invoiceResult.rows[0];
        const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
        
        // 3. Determine new status
        let newStatus = 'partial';
        if (newAmountPaid >= parseFloat(invoice.grand_total)) {
            newStatus = 'paid';
        }

        // 4. Update the invoice
        await client.query(
            `UPDATE invoices SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAmountPaid, newStatus, invoice_id]
        );

        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: paymentResult.rows[0],
            invoice_status: newStatus
        });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};
```

## 4. Folder Structure (Clean Architecture)

```text
/backend
  /src
    /config           # Database, environment variables, third-party configs
    /controllers      # Request handlers (Clients, Projects, Invoices, Payments)
    /middlewares      # Auth, validation, error handling
    /models           # Database schemas / ORM models
    /routes           # API route definitions
    /services         # Business logic (PDF generation, invoice number generation)
    /utils            # Helper functions (date formatting, math)
    app.js            # Express app setup
    server.js         # Entry point

/frontend
  /src
    /assets           # Images, logos
    /components
      /common         # Buttons, Inputs, Modals, Cards
      /layout         # Sidebar, Navbar
      /invoices       # InvoiceForm, InvoiceList, InvoicePDFPreview
      /projects       # ProjectList, ProjectDetails
    /hooks            # Custom React hooks (useInvoices, useProjects)
    /pages            # Route components (Dashboard, Invoices, Projects, Clients)
    /services         # API client (Axios/Fetch wrappers)
    /types            # TypeScript interfaces
    /utils            # Formatting, constants
    App.tsx
```

## 5. Sample UI Layout Structure

### Dashboard
- **Top Row**: 4 Stat Cards (Total Revenue, Pending Payments, Overdue Amount, Active Projects).
- **Middle Row**: Monthly Income Chart (Bar/Line chart showing revenue trends).
- **Bottom Row**: "Recent Invoices" table and "Overdue Invoices" alert list.

### Projects Page (`/projects`)
- **List View**: Table showing Project Name, Client, Billing Type, Status, and Total Invoiced.
- **Detail View**: Tabs for "Overview", "Invoices", and "Settings". "Invoices" tab shows all invoices linked to this specific project.

### Invoices Page (`/invoices`)
- **List View**: Table showing Invoice Number, Client, Project, Issue Date, Due Date, Amount, and Status Badge (Draft/Sent/Paid/Overdue).
- **Create View**: 
  - Select Client -> Select Project.
  - Dynamic form array for Invoice Items (Description, Qty, Price, Tax, Discount).
  - Real-time total calculation at the bottom.
- **Detail View**: 
  - Split layout: Left side shows the professional PDF preview. Right side shows actions (Send Email, Record Payment, Download PDF, Edit).
  - "Record Payment" opens a modal to input amount, date, and reference.

### PDF Template Layout
- **Header**: Company Logo (Left), "INVOICE" text and Invoice # (Right).
- **Meta**: Bill To (Client details), Project Name, Issue Date, Due Date.
- **Table**: Clean, professional table with borders only on the header and bottom.
- **Summary**: Subtotal, Tax, Discount, Grand Total, Amount Paid, Balance Due.
- **Footer**: Payment Terms, Bank Details, Thank You note.
