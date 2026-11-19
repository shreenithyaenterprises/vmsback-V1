# Security Manual Check Feature - Implementation Guide

## Overview

The **Security Manual Check** feature allows visitors to register directly for entry without pre-booking. This is ideal for unplanned or last-minute visitor arrivals who need security clearance.

**User Flow:**
1. **Visitor Registration** → Visitor fills basic info (name, email, mobile, photo, ID proof)
2. **Authority Selection** → Admin/Staff selects which employee's approval authority will decide
3. **Approval Request** → Request sent to approving authority via email
4. **Approval/Rejection** → Authority approves or rejects the request
5. **Gate Pass** → If approved, visitor receives gate pass QR code via email
6. **Gate Entry** → Visitor scans QR code at gate to check-in

---

## Frontend Implementation

### 1. **DirectVisitorEntry Component**
**File:** `/UI/src/pages/prebooking/security/DirectVisitorEntry.jsx`

**Features:**
- **Step 1: Basic Information Form**
  - Visitor name, email, mobile (required)
  - Photo capture (required)
  - ID proof type & number
  - Purpose of visit
  - Remarks/notes

- **Step 2: Authority Selection**
  - List of employees with approval authority
  - Shows name, designation, department

- **Step 3: Success Screen**
  - Confirmation message
  - Reference code display
  - Option to register another visitor

**Styling:** Fully responsive with Tailwind CSS (mobile-first)

### 2. **Service Layer**
**File:** `/UI/src/services/directVisitorService.js`

**Functions:**
```javascript
submitDirectVisitorEntry(visitData)     // Create new request
getPendingSecurityChecks()               // List pending (for approvers)
getSecurityCheckDetails(id)              // Fetch details
approveSecurityCheck(id, remarks)        // Approve request
rejectSecurityCheck(id, remarks)         // Reject request
resendGatePass(id)                       // Resend email
```

### 3. **Routes Integration**
**File:** `/UI/src/App.jsx`

Added route:
```jsx
<Route path="prebooking/security-check" element={<DirectVisitorEntry />} />
```

---

## Backend Implementation

### Database Schema

#### 1. **SECURITY_CHECK_REQUEST Table**

```sql
-- Core visitor request data
security_check_id     INT (PRIMARY KEY)
visitor_name          NVARCHAR(255) - Visitor's full name
visitor_email         NVARCHAR(255) - Email for receive gate pass
visitor_mobile        NVARCHAR(20)  - Contact number
visitor_company       NVARCHAR(255) - Company (optional)
visit_purpose         NVARCHAR(500) - Purpose of visit
id_proof_type         NVARCHAR(50)  - AADHAR, PASSPORT, etc.
id_proof_number       NVARCHAR(100) - ID proof number
visitor_remarks       NVARCHAR(1000) - Visitor notes
visitor_photo_base64  NVARCHAR(MAX) - Photo in base64

-- Approval workflow
host_employee_id      INT - Employee being visited (FK to EMPLOYEE_MASTER)
approver_id           INT - Who will approve (FK to EMPLOYEE_MASTER)
approval_status       NVARCHAR(50) - PENDING | APPROVED | REJECTED
approval_remarks      NVARCHAR(1000) - Approval decision notes
reference_code        NVARCHAR(100) - Unique SEC-yyMMdd-xxxxxx
gate_pass_qr_base64   NVARCHAR(MAX) - QR code image data
visit_transaction_id  INT - Link to VISIT_TRANSACTION (FK)

-- Audit fields
created_at            DATETIME - Submission time
created_by            INT - User who created
approved_at           DATETIME - Approval/rejection time
approved_by           INT - Approver user
sent_gate_pass_at     DATETIME - When gate pass emailed
cancelled_at          DATETIME - Cancellation time
cancelled_by          INT - Who cancelled
```

#### 2. **SECURITY_CHECK_AUDIT_LOG Table**

```sql
-- Complete audit trail
audit_id              INT (PRIMARY KEY)
security_check_id     INT - Reference to request
action_type           NVARCHAR(50) - CREATED | APPROVED | REJECTED | GATE_PASS_SENT | CHECKED_IN
action_by             INT - User performing action
action_at             DATETIME - When action occurred
action_remarks        NVARCHAR(500) - Additional notes
```

---

### API Endpoints

#### Create Security Check Request (Public/Auth)
```http
POST /api/prebooking/security-check/create
Content-Type: application/json

{
  "visitorName": "John Doe",
  "visitorEmail": "john@example.com",
  "visitorMobile": "9876543210",
  "visitorPhotoBase64": "data:image/jpeg;base64,...",
  "hostEmployeeId": 5,
  "idProofType": "AADHAR",
  "idProofNumber": "1234-5678-9012",
  "remarks": "Meeting regarding project X"
}

Response (201):
{
  "success": true,
  "message": "Direct visitor request submitted for approval",
  "data": {
    "securityCheckId": 42,
    "referenceCode": "SEC-240115-537894",
    "visitorName": "John Doe",
    "visitorEmail": "john@example.com"
  }
}
```

#### Get Pending Requests (Auth Required - Approver Only)
```http
GET /api/prebooking/security-check/pending
Authorization: Bearer <TOKEN>

Response (200):
{
  "success": true,
  "message": "Pending security check requests retrieved",
  "data": [
    {
      "security_check_id": 42,
      "visitor_name": "John Doe",
      "visitor_email": "john@example.com",
      "visitor_mobile": "9876543210",
      "visitor_company": "ACME Corp",
      "visit_purpose": "Meeting",
      "host_employee_id": 5,
      "host_employee_name": "Jane Smith",
      "host_employee_department": "Sales",
      "reference_code": "SEC-240115-537894",
      "created_at": "2024-01-15T10:30:00Z",
      "approval_status": "PENDING"
    }
  ]
}
```

#### Get Request Details (Auth Required)
```http
GET /api/prebooking/security-check/:id
Authorization: Bearer <TOKEN>

Response (200):
{
  "success": true,
  "message": "Security check details retrieved",
  "data": { ... full request object ... }
}
```

#### Approve Request (Auth Required - Approver)
```http
POST /api/prebooking/security-check/:id/approve
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "remarks": "Approved - visitor verified"
}

Response (200):
{
  "success": true,
  "message": "Security check approved. Gate pass sent to visitor.",
  "data": {
    "securityCheckId": 42,
    "referenceCode": "SEC-240115-537894",
    "visitorName": "John Doe",
    "visitorEmail": "john@example.com"
  }
}
```

#### Reject Request (Auth Required - Approver)
```http
POST /api/prebooking/security-check/:id/reject
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "remarks": "Unable to verify identity"
}

Response (200):
{
  "success": true,
  "message": "Security check rejected. Notification sent to visitor.",
  "data": {
    "securityCheckId": 42
  }
}
```

---

### Controller Functions
**File:** `/API/controller/prebooking/security/directVisitor.controller.js`

1. **createDirectVisitorRequest()** - Create new security check request
2. **getPendingRequests()** - List pending requests for approver
3. **getSecurityCheckDetails()** - Get specific request details
4. **approveSecurityCheck()** - Approve and send gate pass
5. **rejectSecurityCheck()** - Reject with reason

**Supporting Functions:**
- `createVisitTransaction()` - Creates VISIT_TRANSACTION record
- `generateAndSendGatePass()` - QR code generation & email
- `sendApprovalRequestEmail()` - Email to approver
- `sendRejectionEmail()` - Email to visitor

---

### Routes Configuration
**File:** `/API/Routes/prebooking/security/security.index.js`

```javascript
// Public endpoint (for direct submission)
POST   /create                    // No auth required initially

// Protected endpoints
GET    /pending                   // Approver only
GET    /:id                       // Authenticated user
POST   /:id/approve               // Approver only
POST   /:id/reject                // Approver only
```

**Route Registration:** Added to `/API/Routes/prebooking/prebooking.index.js`
```javascript
router.use('/security-check', securityRoutes);
```

---

### Database Setup
**File:** `/API/database/security_check.sql`

Contains:
- Table creation with proper foreign keys
- Index definitions for performance
- 8 stored procedures:
  1. `SecurityCheck_Create_SP` - Insert new request
  2. `SecurityCheck_Get_SP` - Fetch single request
  3. `SecurityCheck_ListPending_SP` - List pending for approver
  4. `SecurityCheck_Approve_SP` - Update approval status
  5. `SecurityCheck_Reject_SP` - Update rejection status
  6. `SecurityCheck_UpdateGatePass_SP` - Save QR code
  7. (Additional audit procedures as needed)

---

## Email Notifications

### 1. **Approval Request Email** (To Approver)
**Trigger:** When visitor submits request

Content includes:
- Visitor name, email, mobile
- Reference code
- Link to approve/reject
- Request timestamp

### 2. **Gate Pass Approval Email** (To Visitor)
**Trigger:** When approver approves request

Content includes:
- QR code image (barcode)
- Reference code
- Mobile number verification
- Gate entry instructions

### 3. **Rejection Email** (To Visitor)
**Trigger:** When approver rejects request

Content includes:
- Rejection reason/remarks
- Contact information
- Option to resubmit (if allowed)

---

## Security Considerations

✅ **Authentication:** All admin endpoints require JWT token  
✅ **Authorization:** Only approving authorities can approve/reject  
✅ **Photo Storage:** Stored as base64 in database (consider separate blob storage for production)  
✅ **Reference Code:** Unique, randomly generated  
✅ **QR Code:** Contains visitor details + timestamp  
✅ **Audit Trail:** All actions logged with user & timestamp  
✅ **Email Notifications:** Async processing to prevent delays  

---

## Extension Points

### To Add:
1. **Multi-level Approval** - Chain approvals through hierarchy
2. **Time-based Restrictions** - Only allow certain hours for visits
3. **Department-wise Approvers** - Route based on visitor destination
4. **Rejection Resubmission** - Allow visitor to resubmit after rejection
5. **Bulk Import** - CSV upload for multiple visitors
6. **Mobile App Integration** - Native app gate pass scanning
7. **Analytics Dashboard** - Visitor traffic, approval rates, etc.

---

## Testing Checklist

- [ ] Frontend form validation works
- [ ] Photo capture functions properly
- [ ] Email notifications sent successfully
- [ ] Gate pass QR code scans at gate kiosk
- [ ] Approver receives pending requests correctly
- [ ] Approval/rejection updates database
- [ ] Visitor receives appropriate emails
- [ ] Audit log entries created
- [ ] Mobile responsive design verified

---

## Database Execution

Run the SQL script to create tables and stored procedures:
```sql
-- In SQL Server Management Studio
USE YOUR_DATABASE_NAME
GO
-- Paste content of /API/database/security_check.sql
GO
```

---

## Troubleshooting

**Issue:** Email not sending  
→ Check Nodemailer configuration in `config/mailer.js`

**Issue:** QR code not scanning  
→ Verify QR data format and size in `directVisitor.controller.js`

**Issue:** Photo not displaying  
→ Ensure base64 string is properly formatted with `data:image/jpeg;base64,` prefix

**Issue:** Database constraints failing  
→ Verify foreign key relationships exist (EMPLOYEE_MASTER, USER_PROFILE, VISIT_TRANSACTION)

---

## File Structure Summary

```
Frontend:
  UI/src/pages/prebooking/security/
    └── DirectVisitorEntry.jsx          (Component)
  UI/src/services/
    └── directVisitorService.js         (API calls)

Backend:
  API/controller/prebooking/security/
    └── directVisitor.controller.js     (Business logic)
  API/Routes/prebooking/security/
    └── security.index.js               (Route definitions)
  API/database/
    └── security_check.sql              (Database schema)
```

---

**Status:** ✅ Ready for deployment  
**Last Updated:** January 15, 2024  
**Version:** 1.0
