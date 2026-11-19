## 🔧 VISITOR REPORT - COMPLETE FIX & TESTING GUIDE

### ✅ STEP 1: DEPLOY THE FIXED REPORT PROCEDURE
Run this in **SQL Server Management Studio** (SSMS):

```sql
USE [main]
GO

-- Drop the old procedure if exists
IF OBJECT_ID('dbo.Visitor_Report_List_SP', 'P') IS NOT NULL
    DROP PROCEDURE dbo.Visitor_Report_List_SP;
GO

-- Create the fixed procedure from: API/database/visitor_report.sql
-- Copy the entire content from the file and execute it
```

The fixed report SP now:
- ✅ Uses correct VISIT_TRANSACTION columns
- ✅ Filters by CHECKED_IN and COMPLETED status only
- ✅ Defaults to last 30 days if no dates provided
- ✅ Includes DurationMinutes calculation
- ✅ Handles NULL values properly

---

### ✅ STEP 2: RUN DIAGNOSTIC QUERIES
Execute this diagnostic script to verify data exists:

**File:** `API/database/DIAGNOSTIC_VISITOR_REPORT.sql`

```sql
-- Open SSMS and run: API/database/DIAGNOSTIC_VISITOR_REPORT.sql
-- This will show:
-- 1. Total records in VISIT_TRANSACTION
-- 2. Latest check-in/check-out records
-- 3. Record status breakdown
-- 4. Table relationship validation
```

**Expected Results (if everything is working):**
- ✅ Total VISIT_TRANSACTION Records: > 0
- ✅ Records by Status: CHECKED_IN and COMPLETED records visible
- ✅ EntryTime and ExitTime populated (not NULL)
- ✅ PreBookingID populated (not NULL)

---

### 🚨 TROUBLESHOOTING: If Diagnostic Shows 0 Records

#### **ISSUE #1: No data in VISIT_TRANSACTION table**
**Root Cause:** Check-in procedures aren't being called or aren't inserting data

**FIX:**
1. Go to the Gate Entry Kiosk page (GateEntryKiosk.jsx)
2. Manually test check-in by:
   - Scanning a visitor QR code
   - Clicking "Check In" button
   - Verify API returns success

3. Check backend logs for check-in requests:
```bash
Look for logs showing:
"checkInVisitor API called"
"CheckInVisitor_SP" execution
```

4. Verify check-in controller is correctly calling the SP:
   File: `API/controller/prebooking/visit.gate.controller.js`
   Line: ~180 (CheckInVisitor_SP call)

---

#### **ISSUE #2: Data exists but report is still empty**
**Root Cause:** Date filtering or JOIN issues

**FIX:**
Run this debug query in SSMS:

```sql
USE [main]
GO

-- Test 1: Simple query without filters
SELECT COUNT(*) AS TotalRecords
FROM dbo.VISIT_TRANSACTION
WHERE VisitStatus IN ('CHECKED_IN', 'COMPLETED');

-- Test 2: Show what we're actually getting
SELECT TOP 5
    VisitID,
    VisitorName,
    VisitStatus,
    EntryTime,
    ExitTime,
    CreatedAt
FROM dbo.VISIT_TRANSACTION
WHERE VisitStatus IN ('CHECKED_IN', 'COMPLETED')
ORDER BY CreatedAt DESC;

-- Test 3: Test the report SP with NULL (no filters)
DECLARE @xml XML = '<VisitorReport>
    <PageNumber>1</PageNumber>
    <PageSize>10</PageSize>
</VisitorReport>';

EXEC dbo.Visitor_Report_List_SP @XMLData = @xml.query('.');
```

---

### ✅ STEP 3: VERIFY CHECK-IN/CHECK-OUT FLOW

#### **Test Scenario:**
1. **Create a prebooking** - Submit a visitor request
2. **Approve the request** - Manually approve from approval page
3. **Check-in visitor** - Scan QR code at gate
4. **Check-out visitor** - Scan QR code again at gate
5. **View report** - Report should show the visitor

#### **Manual Test in Postman:**

```
// 1. Check-in visitor
POST http://localhost:3000/api/prebooking/public/gate/check-in
Body (JSON):
{
    "VisitID": 1,
    "PPEItems": "Helmet, Safety Vest",
    "EntryGate": "Main Gate",
    "VerifiedByEmployeeID": 1
}

// 2. Check-out visitor
POST http://localhost:3000/api/prebooking/public/gate/check-out
Body (JSON):
{
    "VisitID": 1,
    "ExitGate": "Main Gate"
}

// 3. Get report
POST http://localhost:3000/api/prebooking/report/list
Body (JSON):
{
    "pageNumber": 1,
    "pageSize": 10,
    "fromDate": null,
    "toDate": null
}
```

---

### ✅ STEP 4: VERIFY BACKEND CONTROLLER
File: `API/controller/prebooking/visitor.report.list.js`

Check that it's:
```javascript
✅ Calling Visitor_Report_List_SP
✅ Parsing response correctly
✅ Returning proper JSON structure
```

If controller file doesn't exist, create it:

```javascript
// API/controller/prebooking/visitor.report.list.js
import { STATUS_CODES, STATUS_MESSAGES, createError, logger, executeProcedureXml } from '../../utils/imports.js';

export const getVisitorReport = async (req, res, next) => {
    try {
        const { fromDate, toDate, search, purposeId, visitorType, visitStatus, pageNumber = 1, pageSize = 10 } = req.body;

        const xmlData = `<VisitorReport>
            <FromDate>${fromDate || ''}</FromDate>
            <ToDate>${toDate || ''}</ToDate>
            <Search>${search || ''}</Search>
            <PurposeId>${purposeId || ''}</PurposeId>
            <VisitorType>${visitorType || ''}</VisitorType>
            <VisitStatus>${visitStatus || ''}</VisitStatus>
            <PageNumber>${pageNumber}</PageNumber>
            <PageSize>${pageSize}</PageSize>
        </VisitorReport>`;

        const result = await executeProcedureXml('Visitor_Report_List_SP', 'main', xmlData);

        if (!result.success) {
            return next(createError(STATUS_CODES.SERVER_ERROR, result?.error));
        }

        const parsedResponse = JSON.parse(result.data.ReturnValue);

        if (parsedResponse.Success === 'E') {
            return next(createError(STATUS_CODES.BAD_REQUEST, parsedResponse.Message));
        }

        const items = parsedResponse.Items ? JSON.parse(parsedResponse.Items) : [];

        return res.status(STATUS_CODES.OK).json({
            success: true,
            message: parsedResponse.Message,
            data: {
                items: items,
                totalRecords: parsedResponse.TotalRecords,
                pageNumber: parsedResponse.PageNumber,
                pageSize: parsedResponse.PageSize,
                totalPages: parsedResponse.TotalPages
            }
        });
    } catch (error) {
        logger.error(`Error in getVisitorReport: ${error}`);
        return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
    }
};
```

---

### ✅ STEP 5: VERIFY ROUTES ARE REGISTERED

Check: `API/Routes/prebooking/prebooking.index.js`

It should have:
```javascript
import reportRoutes from './report/report.index.js';
// ...
router.use('/report', reportRoutes);
```

---

### ✅ STEP 6: COMPLETE WORKFLOW TEST

1. **Create Visitor Request**
   - Go to "New Prebooking"
   - Fill visitor details
   - Submit

2. **Approve Request**
   - Go to "Approvals"
   - Click "Approve"

3. **Generate Gate Pass**
   - Click "Generate Gate Pass"
   - QR code generated ✅

4. **Check-in at Gate**
   - Go to "Gate Entry Kiosk"
   - Scan QR code (simulated by typing reference code)
   - Click "Check In"
   - Verify EntryTime recorded ✅

5. **Check-out at Gate**
   - Click "Check Out"
   - Verify ExitTime recorded ✅

6. **View Report**
   - Go to "Reports" → "Visitor Report"
   - Filter: Leave defaults (last 30 days)
   - Should show visitor with:
     - ✅ In Time (EntryTime)
     - ✅ Out Time (ExitTime)
     - ✅ Duration (in minutes)
     - ✅ Photo (if provided)

---

### 🔍 WHAT EACH COLUMN MEANS IN REPORT

| Column | Source | Description |
|--------|--------|-------------|
| **Visitor Name** | VISIT_TRANSACTION.VisitorName | Name provided during prebooking |
| **Reference Code** | VISIT_TRANSACTION.ReferenceCode | Unique QR code identifier (VMS-2024-XXXXX) |
| **In Time** | VISIT_TRANSACTION.EntryTime | When visitor checked in at gate |
| **Out Time** | VISIT_TRANSACTION.ExitTime | When visitor checked out at gate |
| **Duration** | Calculated | Minutes between In Time and Out Time |
| **Status** | VISIT_TRANSACTION.VisitStatus | CHECKED_IN or COMPLETED |
| **Purpose** | VISIT_TRANSACTION.Purpose | Visit purpose |
| **Host** | VISIT_TRANSACTION.HostEmployeeName | Employee visitor is meeting |
| **Department** | VISIT_TRANSACTION.DepartmentName | Host's department |

---

### 📋 CHECKLIST: When to Use This Guide

- [ ] Report showing empty records
- [ ] Check-in/check-out not recording data
- [ ] Report shows old data but not new visitors
- [ ] EntryTime/ExitTime are NULL
- [ ] Reference code not generating
- [ ] Duration calculation missing

---

### ⚠️ COMMON ISSUES & SOLUTIONS

| Issue | Cause | Solution |
|-------|-------|----------|
| Report empty but visitors exist | Date filter too old | Extend date range or reset filters |
| EntryTime/ExitTime NULL | Check-in/check-out not called | Run gate entry kiosk workflow |
| Reference Code NULL | Gate pass not generated | Generate gate pass after approval |
| PreBookingID NULL | Incomplete approval flow | Complete full prebooking → approve → gate pass flow |
| JSON parsing error | Response format issue | Check backend controller is parsing XML response |

