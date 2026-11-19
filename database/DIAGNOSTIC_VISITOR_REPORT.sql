-- ============================================================
-- DIAGNOSTIC SCRIPT: Debug Visitor Report Data Flow
-- Run this to identify why report is returning empty results
-- ============================================================

USE [main]
GO

PRINT '========== DIAGNOSTIC: VISITOR REPORT DATA FLOW ==========='
PRINT GETDATE();

-- 1. Check total records in VISIT_TRANSACTION
PRINT CHAR(10) + '1. Total VISIT_TRANSACTION Records:'
SELECT COUNT(*) AS TotalRecords FROM dbo.VISIT_TRANSACTION;

-- 2. Show latest 10 records in VISIT_TRANSACTION
PRINT CHAR(10) + '2. Latest 10 Records in VISIT_TRANSACTION:'
SELECT TOP 10 
    VisitID, 
    PreBookingID,
    ReferenceCode,
    VisitorName, 
    Purpose,
    HostEmployeeName,
    DepartmentName,
    VisitStatus, 
    EntryTime, 
    ExitTime,
    CreatedAt,
    UpdatedAt
FROM dbo.VISIT_TRANSACTION
ORDER BY CreatedAt DESC;

-- 3. Check records by status
PRINT CHAR(10) + '3. Records by Visit Status:'
SELECT 
    VisitStatus,
    COUNT(*) AS Count
FROM dbo.VISIT_TRANSACTION
GROUP BY VisitStatus;

-- 4. Check records created TODAY
PRINT CHAR(10) + '4. Records Created Today (since 00:00):'
SELECT TOP 10 
    VisitID, 
    ReferenceCode,
    VisitorName, 
    VisitStatus, 
    EntryTime, 
    ExitTime,
    CreatedAt
FROM dbo.VISIT_TRANSACTION
WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
ORDER BY CreatedAt DESC;

-- 5. Check if PreBookingID values exist
PRINT CHAR(10) + '5. PreBookingID Analysis:'
SELECT 
    CASE WHEN PreBookingID IS NULL THEN 'NULL' ELSE 'Has Value' END AS PreBookingIDStatus,
    COUNT(*) AS Count
FROM dbo.VISIT_TRANSACTION
GROUP BY CASE WHEN PreBookingID IS NULL THEN 'NULL' ELSE 'Has Value' END;

-- 6. Check prebooking_request table exists and has data
PRINT CHAR(10) + '6. prebooking_request table - Record Count:'
SELECT COUNT(*) AS TotalRecords FROM dbo.prebooking_request;

-- 7. Check prebooking_submission table exists and has data
PRINT CHAR(10) + '7. prebooking_submission table - Record Count:'
SELECT COUNT(*) AS TotalRecords FROM dbo.prebooking_submission;

-- 8. Check purpose_master table
PRINT CHAR(10) + '8. purpose_master table - Record Count:'
SELECT COUNT(*) AS TotalRecords FROM dbo.purpose_master;

-- 9. Check JOIN compatibility - Do PreBookingIDs match?
PRINT CHAR(10) + '9. PreBookingID Compatibility Check:'
SELECT 
    'VISIT_TRANSACTION has PreBookingID' AS Source,
    COUNT(DISTINCT PreBookingID) AS DistinctPreBookingIDs,
    COUNT(CASE WHEN PreBookingID IS NOT NULL THEN 1 END) AS NonNullCount
FROM dbo.VISIT_TRANSACTION
UNION ALL
SELECT 
    'prebooking_request has prebooking_id' AS Source,
    COUNT(DISTINCT prebooking_id) AS DistinctPreBookingIDs,
    COUNT(CASE WHEN prebooking_id IS NOT NULL THEN 1 END) AS NonNullCount
FROM dbo.prebooking_request;

-- 10. Test JOIN - See if records match across tables
PRINT CHAR(10) + '10. JOIN Test (VISIT_TRANSACTION <-> prebooking_request):'
SELECT TOP 5
    vt.VisitID,
    vt.PreBookingID,
    vt.VisitorName,
    pr.prebooking_id,
    pr.host_employee_id,
    CASE WHEN pr.prebooking_id IS NOT NULL THEN 'MATCHED' ELSE 'NO MATCH' END AS JoinStatus
FROM dbo.VISIT_TRANSACTION vt
LEFT JOIN dbo.prebooking_request pr ON pr.prebooking_id = vt.PreBookingID
ORDER BY vt.CreatedAt DESC;

-- 11. Column names in VISIT_TRANSACTION
PRINT CHAR(10) + '11. VISIT_TRANSACTION Column Names:'
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'VISIT_TRANSACTION' 
    AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION;

-- 12. Run simplified report query (no filters)
PRINT CHAR(10) + '12. Simplified Report Query (NO FILTERS):'
SELECT TOP 10
    vt.VisitID,
    vt.ReferenceCode,
    vt.VisitorName,
    vt.VisitorEmail,
    vt.VisitorMobile,
    vt.Purpose,
    vt.HostEmployeeName,
    vt.DepartmentName,
    vt.VisitStatus,
    vt.EntryTime,
    vt.ExitTime,
    vt.CreatedAt
FROM dbo.VISIT_TRANSACTION vt
ORDER BY vt.CreatedAt DESC;

PRINT CHAR(10) + '========== END DIAGNOSTIC ==========='
