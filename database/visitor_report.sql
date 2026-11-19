USE [main]
GO

CREATE OR ALTER PROCEDURE dbo.Visitor_Report_List_SP
    @XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = NULL;
        IF @XMLData IS NOT NULL AND LTRIM(RTRIM(@XMLData)) <> ''
        BEGIN
            SET @xml = CAST(@XMLData AS XML);
        END;

        DECLARE @FromDate DATE = @xml.value('(/VisitorReport/FromDate)[1]', 'DATE');
        DECLARE @ToDate DATE = @xml.value('(/VisitorReport/ToDate)[1]', 'DATE');
        DECLARE @Search NVARCHAR(160) = NULLIF(LTRIM(RTRIM(@xml.value('(/VisitorReport/Search)[1]', 'NVARCHAR(160)'))), '');
        DECLARE @PurposeId INT = @xml.value('(/VisitorReport/PurposeId)[1]', 'INT');
        DECLARE @VisitorType NVARCHAR(80) = NULLIF(LTRIM(RTRIM(@xml.value('(/VisitorReport/VisitorType)[1]', 'NVARCHAR(80)'))), '');
        DECLARE @VisitStatus NVARCHAR(40) = NULLIF(LTRIM(RTRIM(@xml.value('(/VisitorReport/VisitStatus)[1]', 'NVARCHAR(40)'))), '');
        DECLARE @ApprovalStatus NVARCHAR(40) = NULLIF(LTRIM(RTRIM(@xml.value('(/VisitorReport/ApprovalStatus)[1]', 'NVARCHAR(40)'))), '');
        DECLARE @PageNumber INT = @xml.value('(/VisitorReport/PageNumber)[1]', 'INT');
        DECLARE @PageSize INT = @xml.value('(/VisitorReport/PageSize)[1]', 'INT');

        SET @PageNumber = CASE WHEN @PageNumber IS NULL OR @PageNumber < 1 THEN 1 ELSE @PageNumber END;
        SET @PageSize = CASE WHEN @PageSize IS NULL OR @PageSize < 1 THEN 10 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

        -- If no date range specified, default to last 90 days
        IF @FromDate IS NULL
            SET @FromDate = DATEADD(DAY, -90, CAST(GETDATE() AS DATE));
        IF @ToDate IS NULL
            SET @ToDate = CAST(GETDATE() AS DATE);

        ;WITH VisitTransactionData AS (
            SELECT
                vt.VisitID,
                vt.ReferenceCode,
                vt.VisitorName,
                vt.VisitorEmail,
                vt.VisitorMobile,
                vt.VisitorPhotoBase64 AS VisitorPhoto,
                ps.company_name AS VisitorCompanyName,
                0 AS PurposeId,
                ISNULL(vt.Purpose, 'N/A') AS PurposeName,
                ISNULL(NULLIF(LTRIM(RTRIM(vt.VisitType)), ''), 'GENERAL') AS VisitorCategory,
                vt.HostEmployeeName,
                vt.DepartmentName,
                CAST(vt.CreatedAt AS DATE) AS VisitDate,
                vt.ApprovalStatus,
                vt.VisitStatus,
                vt.EntryTime,
                vt.ExitTime,
                CASE
                    WHEN LOWER(ISNULL(LTRIM(RTRIM(vt.PPEItems)), '')) IN ('', 'none') THEN NULL
                    ELSE LTRIM(RTRIM(vt.PPEItems))
                END AS IssuedPPEItems,
                CASE
                    WHEN LOWER(ISNULL(LTRIM(RTRIM(vt.ReturnedPPEItems)), '')) IN ('', 'none') THEN NULL
                    ELSE LTRIM(RTRIM(vt.ReturnedPPEItems))
                END AS ReturnedPPEItems,
                CASE
                    WHEN LOWER(ISNULL(LTRIM(RTRIM(vt.PPEItems)), '')) IN ('', 'none')
                        AND LOWER(ISNULL(LTRIM(RTRIM(vt.ReturnedPPEItems)), '')) IN ('', 'none')
                        THEN 'NOT_APPLICABLE'
                    WHEN LOWER(ISNULL(LTRIM(RTRIM(vt.PPEItems)), '')) IN ('', 'none')
                        OR LOWER(ISNULL(LTRIM(RTRIM(vt.ReturnedPPEItems)), '')) IN ('', 'none')
                        THEN 'MISMATCH'
                    WHEN EXISTS (
                        SELECT 1
                        FROM STRING_SPLIT(vt.PPEItems, ',') AS issued
                        WHERE LTRIM(RTRIM(issued.value)) <> ''
                            AND LOWER(LTRIM(RTRIM(issued.value))) <> 'none'
                            AND NOT EXISTS (
                                SELECT 1
                                FROM STRING_SPLIT(vt.ReturnedPPEItems, ',') AS returned
                                WHERE LOWER(LTRIM(RTRIM(returned.value))) = LOWER(LTRIM(RTRIM(issued.value)))
                            )
                    )
                        OR EXISTS (
                            SELECT 1
                            FROM STRING_SPLIT(vt.ReturnedPPEItems, ',') AS returned
                            WHERE LTRIM(RTRIM(returned.value)) <> ''
                                AND LOWER(LTRIM(RTRIM(returned.value))) <> 'none'
                                AND NOT EXISTS (
                                    SELECT 1
                                    FROM STRING_SPLIT(vt.PPEItems, ',') AS issued
                                    WHERE LOWER(LTRIM(RTRIM(issued.value))) = LOWER(LTRIM(RTRIM(returned.value)))
                                )
                        )
                        THEN 'MISMATCH'
                    ELSE 'MATCHED'
                END AS PPEComplianceStatus,
                CASE 
                    WHEN vt.EntryTime IS NOT NULL AND vt.ExitTime IS NOT NULL 
                    THEN DATEDIFF(MINUTE, vt.EntryTime, vt.ExitTime)
                    ELSE 0
                END AS DurationMinutes,
                vt.CreatedAt
            FROM dbo.VISIT_TRANSACTION vt
            LEFT JOIN dbo.prebooking_submission ps ON ps.prebooking_id = vt.PreBookingID
            WHERE vt.VisitStatus IN ('CHECKED_IN','APPROVED','CHECKED_OUT', 'COMPLETED', 'REJECTED', 'PENDING_ENTRY')
                OR vt.ApprovalStatus IN ('APPROVED', 'REJECTED')
        ),
        PendingDecisionPrebookingData AS (
            SELECT
                CAST(NULL AS INT) AS VisitID,
                CAST(NULL AS NVARCHAR(100)) AS ReferenceCode,
                ps.visitor_name AS VisitorName,
                ps.visitor_email AS VisitorEmail,
                ps.visitor_mobile AS VisitorMobile,
                ps.visitor_photo AS VisitorPhoto,
                ps.company_name AS VisitorCompanyName,
                ps.purpose_id AS PurposeId,
                ISNULL(pm.name, 'N/A') AS PurposeName,
                'PREBOOKING' AS VisitorCategory,
                em.name AS HostEmployeeName,
                dm.name AS DepartmentName,
                ps.visit_date AS VisitDate,
                pr.status AS ApprovalStatus,
                pr.status AS VisitStatus,
                CAST(NULL AS DATETIME) AS EntryTime,
                CAST(NULL AS DATETIME) AS ExitTime,
                CAST(NULL AS NVARCHAR(MAX)) AS IssuedPPEItems,
                CAST(NULL AS NVARCHAR(MAX)) AS ReturnedPPEItems,
                'NOT_APPLICABLE' AS PPEComplianceStatus,
                0 AS DurationMinutes,
                COALESCE(val.action_time, ps.created_at, pr.created_at) AS CreatedAt
            FROM dbo.prebooking_request pr
            INNER JOIN dbo.prebooking_submission ps ON ps.prebooking_id = pr.prebooking_id
            LEFT JOIN dbo.purpose_master pm ON pm.purpose_id = ps.purpose_id
            LEFT JOIN dbo.employee_master em ON em.employee_id = pr.host_employee_id
            LEFT JOIN dbo.department_master dm ON dm.department_id = pr.department_id
            OUTER APPLY (
                SELECT TOP 1 action_time
                FROM dbo.visit_approval_log
                WHERE prebooking_id = pr.prebooking_id
                    AND action IN ('APPROVED', 'REJECTED')
                ORDER BY action_time DESC, approval_log_id DESC
            ) val
            WHERE pr.status IN ('APPROVED', 'REJECTED')
                AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.VISIT_TRANSACTION vt
                    WHERE vt.PreBookingID = pr.prebooking_id
                )
        ),
        BaseData AS (
            SELECT * FROM VisitTransactionData
            UNION ALL
            SELECT * FROM PendingDecisionPrebookingData
        ),
        Filtered AS (
            SELECT *
            FROM BaseData
            WHERE (@FromDate IS NULL OR VisitDate >= @FromDate)
                AND (@ToDate IS NULL OR VisitDate <= @ToDate)
                AND (@VisitStatus IS NULL OR VisitStatus = @VisitStatus)
                AND (@ApprovalStatus IS NULL OR ApprovalStatus = @ApprovalStatus)
                AND (@PurposeId IS NULL OR PurposeId = @PurposeId)
                AND (@VisitorType IS NULL OR VisitorCategory = @VisitorType)
                AND (
                    @Search IS NULL
                    OR VisitorName LIKE '%' + @Search + '%'
                    OR VisitorEmail LIKE '%' + @Search + '%'
                    OR VisitorMobile LIKE '%' + @Search + '%'
                    OR ReferenceCode LIKE '%' + @Search + '%'
                    OR HostEmployeeName LIKE '%' + @Search + '%'
                    OR DepartmentName LIKE '%' + @Search + '%'
                    OR PurposeName LIKE '%' + @Search + '%'
                )
        ),
        Numbered AS (
            SELECT
                *,
                ROW_NUMBER() OVER (ORDER BY CreatedAt DESC, VisitID DESC) AS RowNum,
                COUNT(1) OVER () AS TotalRecords
            FROM Filtered
        ),
        Paged AS (
            SELECT *
            FROM Numbered
            WHERE RowNum BETWEEN ((@PageNumber - 1) * @PageSize) + 1
                AND (@PageNumber * @PageSize)
        )
        SELECT (
            SELECT
                'S' AS Success,
                'Visitor report fetched' AS Message,
                JSON_QUERY((
                    SELECT
                        VisitID,
                        ReferenceCode,
                        VisitorName,
                        VisitorEmail,
                        VisitorMobile,
                        VisitorPhoto,
                        VisitorCompanyName,
                        PurposeId,
                        PurposeName,
                        VisitorCategory,
                        HostEmployeeName,
                        DepartmentName,
                        VisitDate,
                        ApprovalStatus,
                        VisitStatus,
                        EntryTime,
                        ExitTime,
                        IssuedPPEItems,
                        ReturnedPPEItems,
                        PPEComplianceStatus,
                        DurationMinutes,
                        CreatedAt
                    FROM Paged
                    ORDER BY RowNum
                    FOR JSON PATH
                )) AS Items,
                COALESCE((SELECT TOP 1 TotalRecords FROM Numbered), 0) AS TotalRecords,
                @PageNumber AS PageNumber,
                @PageSize AS PageSize,
                CASE
                    WHEN COALESCE((SELECT TOP 1 TotalRecords FROM Numbered), 0) = 0 THEN 0
                    ELSE CEILING(COALESCE((SELECT TOP 1 TotalRecords FROM Numbered), 0) * 1.0 / @PageSize)
                END AS TotalPages
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SELECT (
            SELECT 'E' AS Success, @ErrorMessage AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END CATCH;
END
GO
