# 🔐 APPROVAL FLOW DOCUMENTATION

## 📋 Overview

The approval flow is a multi-level authorization system that determines whether a visitor's pre-booking request requires approval before entry is granted. It supports:

- **Employee-wise approval rules** (APPROVAL_AUTHORITY_MASTER)
- **Visitor-type based rules** (APPROVAL_RULE_MASTER)
- **Multi-level approvals** (L1, L2, etc.)
- **Complete audit trail** (VISIT_APPROVAL_LOG)

---

## 🔄 FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│  VISITOR FILLS PREBOOKING FORM                              │
│  - Name, Email, Visit Date                                  │
│  - Selects PURPOSE, ID PROOF                                │
│  - **SELECTS HOST EMPLOYEE** (Critical!)                    │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM: Get Approval Authority                             │
│  POST /api/prebooking/approval/authority                    │
│  {                                                           │
│    "hostEmployeeId": 5,                                     │
│    "visitorTypeCode": "NORMAL"                              │
│  }                                                           │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
              ┌───────────────┐
              │ Check Employee│
              │ approval_req? │
              └───────┬───────┘
                      │
         ┌────────────┴──────────────┐
         │ YES                       │ NO
         ↓                           ↓
   ┌─────────────┐          ┌──────────────┐
   │ Check       │          │ AUTO APPROVE │
   │ Employee-   │          │ Entry Allowed│
   │ wise Rule   │          └──────────────┘
   │ (L1, L2..) │
   └─────┬───────┘
         │
    ┌────┴────┐
    │ Found?  │
    └────┬────┘
         │
    ┌────┴──────────────────────┐
    │ YES                        │ NO
    ↓                            ↓
  ┌─────────┐          ┌──────────────────┐
  │ Use     │          │ Fallback: Check  │
  │ Approver│          │ Visitor-type Rule│
  └────┬────┘          │ (dept head)      │
       │               └──────────┬───────┘
       │                          │
       │                     ┌────┴─────┐
       │                     │ Approver? │
       │                     └────┬─────┘
       │                          │
       └──────────┬───────────────┘
                  ↓
       ┌────────────────────┐
       │ CREATE APPROVAL    │
       │ RECORD (PENDING)   │
       │ visit_approval_log │
       └────────┬───────────┘
                ↓
   ┌────────────────────────────┐
   │ SEND EMAIL TO APPROVER     │
   │ with action link           │
   └────────────┬───────────────┘
                ↓
   ┌───────────────────────────────┐
   │ APPROVER REVIEWS              │
   │ /api/prebooking/approval/     │
   │ pending                       │
   └────────────┬──────────────────┘
                ↓
    ┌───────────────────┐
    │ APPROVE/REJECT    │
    │ POST /api/        │
    │ prebooking/       │
    │ approval/decision │
    └────────┬──────────┘
             ↓
   ┌──────────────────────┐
   │ UPDATE STATUS        │
   │ visit_approval_log   │
   │ + prebooking_request │
   └──────────┬───────────┘
              ↓
    ┌──────────────────┐
    │ APPROVED?        │
    └────┬─────────────┘
         │
    ┌────┴───────────────────┐
    │ YES                    │ NO
    ↓                        ↓
┌───────────┐        ┌──────────────┐
│ ENTRY     │        │ ENTRY DENIED │
│ ALLOWED   │        │ Visitor      │
│ Badge     │        │ Notified     │
│ Generated │        └──────────────┘
└───────────┘
```

---

## 🗄️ DATABASE TABLES

### 1. **APPROVAL_AUTHORITY_MASTER** (Employee-wise rules)
```sql
authority_id INT PK
employee_id INT -- Who needs approval
approver_employee_id INT -- Who approves
approval_level INT -- 1 (L1), 2 (L2), etc.
is_active BIT
created_at DATETIME
updated_at DATETIME
```

**Example:**
| authority_id | Employee | Approver | Level | Status |
|---|---|---|---|---|
| 1 | John (Dev) | Sarah (DevLead) | 1 | Active |
| 2 | Mary (Vendor) | Admin | 1 | Active |
| 3 | Director | MD | 1 | Active |

### 2. **VISIT_APPROVAL_LOG** (Audit trail)
```sql
approval_log_id INT PK
prebooking_id INT FK
approval_level INT -- Current level being approved
approver_id INT FK
action NVARCHAR(20) -- PENDING, APPROVED, REJECTED
remarks NVARCHAR(500)
action_time DATETIME
created_at DATETIME
```

**Example:**
| Log ID | Prebooking | Level | Approver | Action | Time |
|---|---|---|---|---|---|
| 100 | 50 | 1 | 5 (Sarah) | PENDING | 2026-03-04 09:00 |
| 100 | 50 | 1 | 5 (Sarah) | APPROVED | 2026-03-04 10:30 |

### 3. **EMPLOYEE_MASTER** (Updated)
```sql
-- NEW FIELD:
approval_required BIT -- 0 = Auto approve, 1 = Needs approval
```

### 4. **APPROVAL_RULE_MASTER** (Existing - Visitor type based)
```sql
rule_id INT PK
visitor_type_code NVARCHAR -- NORMAL, VENDOR, VIP
approval_status NVARCHAR -- 'Approval Required' / 'No Approval'
```

---

## 📡 API ENDPOINTS

### **Common Scenarios:**

#### **Scenario 1: Junior Employee (Normal Flow)**
```javascript
// 1. Visitor selects Employee A (Junior Dev)
//    System checks → approval_required = 1

// 2. GET APPROVAL AUTHORITY
POST /api/prebooking/approval/authority
{
  "hostEmployeeId": 5,  // Junior Dev
  "visitorTypeCode": "NORMAL"
}

// Response:
{
  "success": true,
  "data": {
    "approverId": 8,           // Sarah (Dev Lead)
    "approverName": "Sarah M",
    "approverEmail": "sarah@company.com",
    "approvalLevel": 1,
    "requiresApproval": true
  }
}

// 3. CREATE APPROVAL RECORD
POST /api/prebooking/approval/record
{
  "prebookingId": 50,
  "approverId": 8,
  "approvalLevel": 1
}

// ✉️ Email sent to sarah@company.com:
// "Visitor John wants to meet John (Dev)"
// [Approve] [Reject]
```

#### **Scenario 2: VIP/Director (Auto-Approved)**
```javascript
// 1. Visitor selects Director B
//    System checks → approval_required = 0

// 2. GET APPROVAL AUTHORITY
POST /api/prebooking/approval/authority
{
  "hostEmployeeId": 2,  // Director
  "visitorTypeCode": "VIP"
}

// Response:
{
  "success": true,
  "data": {
    "approverId": null,           // No approval needed
    "approverName": null,
    "requiresApproval": false
  }
}

// ✅ ENTRY ALLOWED IMMEDIATELY
```

#### **Scenario 3: Vendor (Visitor-Type Rule)**
```javascript
// 1. Visitor fills form as VENDOR

// 2. GET APPROVAL AUTHORITY
POST /api/prebooking/approval/authority
{
  "hostEmployeeId": 10,           // Engineer
  "visitorTypeCode": "VENDOR"     // KEY: Visitor is VENDOR
}

// SYSTEM LOGIC:
// → Check if Engineer has employee-wise rule → NO
// → Fallback: Check APPROVAL_RULE_MASTER for VENDOR
// → approval_status = "Approval Required"
// → Get Engineer's dept head as approver

// Response:
{
  "success": true,
  "data": {
    "approverId": 9,              // Dept Head (Manager)
    "approverName": "Mike Chen",
    "approverEmail": "mike@company.com",
    "approvalLevel": 1,
    "requiresApproval": true
  }
}
```

---

## 🔌 API Reference

### **Get Approval Authority**
```
POST /api/prebooking/approval/authority

Request:
{
  "hostEmployeeId": 5,
  "visitorTypeCode": "NORMAL"
}

Response:
{
  "approverId": 8,
  "approverName": "Sarah",
  "approverEmail": "sarah@company.com",
  "approvalLevel": 1,
  "requiresApproval": true
}
```

### **Create Approval Record**
```
POST /api/prebooking/approval/record

Request:
{
  "prebookingId": 50,
  "approverId": 8,
  "approvalLevel": 1
}

Response:
{
  "success": true,
  "data": { "approvalLogId": 100 }
}
```

### **Get Pending Approvals** (for Approver)
```
GET /api/prebooking/approval/pending
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "approvalRequests": [
      {
        "approvalLogId": 100,
        "prebookingId": 50,
        "visitorName": "John Doe",
        "visitorEmail": "john@external.com",
        "visitDate": "2026-03-05",
        "hostEmployeeName": "Sarah M",
        "status": "PENDING",
        "createdAt": "2026-03-04T09:00:00"
      }
    ]
  }
}
```

### **Submit Approval Decision**
```
POST /api/prebooking/approval/decision

Request:
{
  "approvalLogId": 100,
  "action": "APPROVED",  // or "REJECTED"
  "remarks": "Visitor verified"
}

Response:
{
  "success": true,
  "message": "Visit approved successfully"
}
```

### **Get Approval Status**
```
GET /api/prebooking/approval/status?prebookingId=50

Response:
{
  "success": true,
  "data": {
    "approvalHistory": [
      {
        "approvalLogId": 100,
        "approvalLevel": 1,
        "approverName": "Sarah M",
        "action": "APPROVED",
        "remarks": "Verified visitor",
        "actionTime": "2026-03-04T10:30:00"
      }
    ]
  }
}
```

---

## 🛠️ Management - Create/Edit Approval Authority

### **Create Approval Authority** (Admin Panel)
```
POST /api/master/approval-authority

Request:
{
  "employeeId": 5,         // John (Dev) needs approval from
  "approverId": 8,         // Sarah (Dev Lead)
  "approvalLevel": 1       // L1 approval
}

Response:
{
  "success": true,
  "data": { "authorityId": 1 }
}
```

### **Get All Approval Authorities**
```
GET /api/master/approval-authority

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "authorityId": 1,
        "employeeName": "John",
        "approverName": "Sarah",
        "approvalLevel": 1,
        "isActive": true
      }
    ]
  }
}
```

### **Delete Approval Authority**
```
DELETE /api/master/approval-authority

Request:
{
  "authorityId": 1
}

Response:
{
  "success": true,
  "message": "Approval authority deleted"
}
```

---

## 🧠 Real-World Examples

### **Case 1: Junior Developer**
```
Visitor: "I want to meet John (Junior Dev)"

System Flow:
1. John.approval_required = 1 ✓
2. Check APPROVAL_AUTHORITY_MASTER for John
   → Found: Sarah (Dev Lead) - L1
3. Create approval record → PENDING
4. Email Sarah the link
5. Sarah clicks → GET /api/prebooking/approval/pending
6. Sarah reviews, clicks [APPROVE]
7. UPDATE visit_approval_log → APPROVED
8. Visitor allowed entry

Audit Log:
┌──────────────────────────────────────────┐
│ Approval Log                             │
├──────────────────────────────────────────┤
│ Visitor: John Doe                        │
│ Host: John Smith (Dev)                   │
│ Level: 1                                 │
│ Approver: Sarah (Dev Lead)               │
│ Action: APPROVED at 10:30 AM             │
│ Remarks: "Verified identity"             │
└──────────────────────────────────────────┘
```

### **Case 2: Sensitive Vendor (2-Level Approval)**
```
Visitor: "Meeting with Engineer for sensitive project"
Visitor Type: VENDOR

System Flow:
1. Engineer.approval_required = 1 ✓
2. Check AUTHORITY → NO employee-wise rule
3. Fallback: VENDOR requires "Approval Required"
4. Auto-assign: Engineer's Dept Head (Manager)
5. Send to Manager
6. Manager approves/adds remark
7. UPDATE status → APPROVED
8. Badge generation starts

**Note:** For multi-level, repeat step 3-6
```

### **Case 3: Director/VIP (Auto-Approved)**
```
Visitor: "Meeting with Director John"

System Flow:
1. Director.approval_required = 0
2. NO APPROVAL NEEDED
3. Entry Allowed ✓
4. Badge Generated ✓
```

---

## 📊 Status Transitions

```
PREBOOKING_REQUEST.status:
PENDING → SUBMITTED → APPROVED → (Entry Allowed)
                   ↓
                 REJECTED → (Visitor Notified)

VISIT_APPROVAL_LOG.action:
PENDING → APPROVED / REJECTED
```

---

## 🔒 Security Checks

```javascript
// 1. Only the assigned approver can approve/reject
if (req.user.id !== approvalLog.approver_id) {
  return 401 UNAUTHORIZED;
}

// 2. Can't edit already approved/rejected records
if (approvalLog.action !== 'PENDING') {
  return 409 CONFLICT;
}

// 3. Approval log must exist
if (!approvalLog) {
  return 404 NOT_FOUND;
}
```

---

## 📅 Audit & Compliance

All approvals are logged in `visit_approval_log`:
- ✅ WHO approved (approver_id)
- ✅ WHAT decision (APPROVED/REJECTED)
- ✅ WHEN (action_time)
- ✅ WHY (remarks)
- ✅ Full history per visit

**Compliance Export:**
```sql
SELECT * FROM visit_approval_log
WHERE action_time BETWEEN '2026-01-01' AND '2026-03-31'
ORDER BY action_time DESC;
```

---

## 🚀 Implementation Checklist

- [x] Database: APPROVAL_AUTHORITY_MASTER
- [x] Database: VISIT_APPROVAL_LOG
- [x] Procedure: GetApprovalAuthority_SP
- [x] Procedure: CreateApprovalRecord_SP
- [x] Procedure: SubmitApprovalDecision_SP
- [x] Controller: approval.controller.js
- [x] Controller: approvalAuthority.controller.js
- [x] Routes: /approval
- [x] Routes: /approval-authority
- [ ] **Frontend: Prebooking Form Integration**
- [ ] **Frontend: Approver Dashboard**
- [ ] **Email: Approval Notification Template**
- [ ] **Testing: All 3 scenarios**

