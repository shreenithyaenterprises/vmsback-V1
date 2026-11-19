-- Debug: Check why count is 0
USE [main]
GO

-- Step 1: Count records with COMPLETED/CHECKED_IN status
PRINT 'Step 1: Records with COMPLETED or CHECKED_IN status:'
SELECT COUNT(*) AS Total_Records
FROM dbo.VISIT_TRANSACTION 
WHERE VisitStatus IN ('CHECKED_IN', 'COMPLETED');

-- Step 2: Count with date filtering
PRINT CHAR(10) + 'Step 2: Records with status filter + date filter (last 90 days):'
DECLARE @FromDate DATE = DATEADD(DAY, -90, CAST(GETDATE() AS DATE));
DECLARE @ToDate DATE = CAST(GETDATE() AS DATE);

PRINT 'FromDate: ' + CONVERT(VARCHAR, @FromDate);
PRINT 'ToDate: ' + CONVERT(VARCHAR, @ToDate);

SELECT COUNT(*) AS Total_Records
FROM dbo.VISIT_TRANSACTION 
WHERE VisitStatus IN ('CHECKED_IN', 'COMPLETED')
AND CAST(CreatedAt AS DATE) >= @FromDate
AND CAST(CreatedAt AS DATE) <= @ToDate;

-- Step 3: Show the actual records
PRINT CHAR(10) + 'Step 3: Actual records matching filters:'
SELECT 
	VisitID,
	VisitorName,
	VisitStatus,
	CAST(CreatedAt AS DATE) AS VisitDate,
	EntryTime,
	ExitTime
FROM dbo.VISIT_TRANSACTION 
WHERE VisitStatus IN ('CHECKED_IN', 'COMPLETED')
AND CAST(CreatedAt AS DATE) >= @FromDate
AND CAST(CreatedAt AS DATE) <= @ToDate
ORDER BY CreatedAt DESC;
