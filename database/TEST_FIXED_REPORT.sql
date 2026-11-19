-- ============================================================
-- QUICK TEST: Visitor Report SP - Latest Version
-- Run this after deploying fixed visitor_report.sql
-- ============================================================

USE [main]
GO

PRINT '========== TESTING FIXED VISITOR_REPORT_LIST_SP ==========='
PRINT 'Current Date/Time: ' + CONVERT(VARCHAR, GETDATE(), 121);
PRINT '';

-- TEST 1: Run with NO parameters (should return last 30 days)
PRINT CHAR(10) + 'TEST 1: Report with NO filters (last 30 days, all status, page 1, size 10)'
DECLARE @xml1 XML = '<VisitorReport>
    <PageNumber>1</PageNumber>
    <PageSize>10</PageSize>
</VisitorReport>';
DECLARE @xmlStr1 NVARCHAR(MAX) = CONVERT(NVARCHAR(MAX), @xml1);

EXEC dbo.Visitor_Report_List_SP @XMLData = @xmlStr1;

-- TEST 2: Run with specific date range
PRINT CHAR(10) + CHAR(10) + 'TEST 2: Report with date range (current date only, page 1, size 10)'
DECLARE @xml2 XML;
SET @xml2 = CAST(CONCAT('<VisitorReport>
    <FromDate>', CAST(GETDATE() AS DATE), '</FromDate>
    <ToDate>', CAST(GETDATE() AS DATE), '</ToDate>
    <PageNumber>1</PageNumber>
    <PageSize>10</PageSize>
</VisitorReport>') AS XML);
DECLARE @xmlStr2 NVARCHAR(MAX) = CONVERT(NVARCHAR(MAX), @xml2);

EXEC dbo.Visitor_Report_List_SP @XMLData = @xmlStr2;

-- TEST 3: Run with CHECKED_IN status filter only
PRINT CHAR(10) + CHAR(10) + 'TEST 3: Report with CHECKED_IN status only'
DECLARE @xml3 XML = '<VisitorReport>
    <VisitStatus>CHECKED_IN</VisitStatus>
    <PageNumber>1</PageNumber>
    <PageSize>10</PageSize>
</VisitorReport>';
DECLARE @xmlStr3 NVARCHAR(MAX) = CONVERT(NVARCHAR(MAX), @xml3);

EXEC dbo.Visitor_Report_List_SP @XMLData = @xmlStr3;

-- TEST 4: Test search functionality
PRINT CHAR(10) + CHAR(10) + 'TEST 4: Report with search filter'
DECLARE @xml4 XML = '<VisitorReport>
    <Search>visitor</Search>
    <PageNumber>1</PageNumber>
    <PageSize>10</PageSize>
</VisitorReport>';
DECLARE @xmlStr4 NVARCHAR(MAX) = CONVERT(NVARCHAR(MAX), @xml4);

EXEC dbo.Visitor_Report_List_SP @XMLData = @xmlStr4;

PRINT CHAR(10) + CHAR(10) + '========== END TESTS ==========='
PRINT 'If you see items in the results, the fix worked! ✅'
PRINT 'If you still see empty items, check the diagnostic results.'
