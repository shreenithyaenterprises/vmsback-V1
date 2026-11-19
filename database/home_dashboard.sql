USE [main]
GO

CREATE OR ALTER PROCEDURE dbo.Home_Dashboard_Summary_SP
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

        DECLARE @ForDate DATE = NULL;
        IF @xml IS NOT NULL
        BEGIN
            SET @ForDate = @xml.value('(/Dashboard/ForDate)[1]', 'DATE');
        END;

        IF @ForDate IS NULL
            SET @ForDate = CAST(GETDATE() AS DATE);

        ;WITH TodayVisits AS (
            SELECT
                vt.VisitID,
                vt.PreBookingID,
                vt.ReferenceCode,
                vt.VisitorName,
                vt.VisitorEmail,
                vt.VisitorMobile,
                ISNULL(NULLIF(LTRIM(RTRIM(vt.DepartmentName)), ''), 'Unassigned') AS DepartmentName,
                vt.HostEmployeeName,
                vt.Purpose,
                vt.VisitStatus,
                vt.EntryTime,
                vt.ExitTime,
                vt.CreatedAt,
                CASE
                    WHEN UPPER(ISNULL(vt.VisitType, '')) = 'VIP'
                        OR UPPER(ISNULL(vt.Purpose, '')) LIKE '%VIP%'
                    THEN 1
                    ELSE 0
                END AS IsVIP
            FROM dbo.VISIT_TRANSACTION vt
            WHERE CAST(vt.CreatedAt AS DATE) = @ForDate
        ),
        DepartmentWise AS (
            SELECT
                DepartmentName,
                COUNT(1) AS VisitorCount,
                SUM(CASE WHEN VisitStatus IN ('CHECKED_OUT', 'COMPLETED') THEN 1 ELSE 0 END) AS CheckedOutCount,
                SUM(CASE WHEN VisitStatus = 'CHECKED_IN' THEN 1 ELSE 0 END) AS CheckedInCount
            FROM TodayVisits
            GROUP BY DepartmentName
        ),
        UpcomingVisitors AS (
            SELECT
                pr.prebooking_id AS PreBookingId,
                pr.visitor_name AS VisitorName,
                pr.visitor_email AS VisitorEmail,
                ISNULL(ps.visitor_mobile, '') AS VisitorMobile,
                ISNULL(d.name, 'Unassigned') AS DepartmentName,
                ISNULL(e.name, '') AS HostEmployeeName,
                pr.visit_date AS VisitDate,
                pr.status AS RequestStatus,
                ISNULL(pm.name, '') AS PurposeName,
                CASE
                    WHEN UPPER(ISNULL(pm.name, '')) LIKE '%VIP%'
                    THEN 1
                    ELSE 0
                END AS IsVIP
            FROM dbo.prebooking_request pr
            LEFT JOIN dbo.prebooking_submission ps ON ps.prebooking_id = pr.prebooking_id
            LEFT JOIN dbo.employee_master e ON e.employee_id = pr.host_employee_id
            LEFT JOIN dbo.department_master d ON d.department_id = pr.department_id
            LEFT JOIN dbo.purpose_master pm ON pm.purpose_id = ps.purpose_id
            WHERE pr.visit_date = @ForDate
                AND pr.status IN ('PENDING', 'SUBMITTED', 'APPROVED')
                AND (
                    NOT EXISTS (
                        SELECT 1
                        FROM dbo.VISIT_TRANSACTION vt
                        WHERE vt.PreBookingID = pr.prebooking_id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM dbo.VISIT_TRANSACTION vt
                        WHERE vt.PreBookingID = pr.prebooking_id
                            AND vt.EntryTime IS NULL
                            AND (vt.VisitStatus IS NULL OR vt.VisitStatus NOT IN ('CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'))
                    )
                )
        ),
        AllPrebookings AS (
            SELECT
                pr.prebooking_id AS PreBookingId,
                pr.visitor_name AS VisitorName,
                pr.visitor_email AS VisitorEmail,
                ISNULL(ps.visitor_mobile, '') AS VisitorMobile,
                ISNULL(d.name, 'Unassigned') AS DepartmentName,
                ISNULL(e.name, '') AS HostEmployeeName,
                pr.visit_date AS VisitDate,
                pr.status AS RequestStatus,
                ISNULL(pm.name, '') AS PurposeName,
                CASE
                    WHEN UPPER(ISNULL(pm.name, '')) LIKE '%VIP%'
                    THEN 1
                    ELSE 0
                END AS IsVIP
            FROM dbo.prebooking_request pr
            LEFT JOIN dbo.prebooking_submission ps ON ps.prebooking_id = pr.prebooking_id
            LEFT JOIN dbo.employee_master e ON e.employee_id = pr.host_employee_id
            LEFT JOIN dbo.department_master d ON d.department_id = pr.department_id
            LEFT JOIN dbo.purpose_master pm ON pm.purpose_id = ps.purpose_id
            WHERE pr.visit_date = @ForDate
                AND pr.status IN ('PENDING', 'SUBMITTED', 'APPROVED')
        SELECT (
            SELECT
                'S' AS Success,
                'Home dashboard fetched' AS Message,
                @ForDate AS ForDate,
                (SELECT COUNT(1) FROM TodayVisits) AS TodayTotalVisitors,
                (SELECT COUNT(1) FROM UpcomingVisitors) AS TodayPrebookingVisitors,
                (
                    SELECT COUNT(1)
                    FROM TodayVisits
                    WHERE IsVIP = 1
                ) + (
                    SELECT COUNT(1)
                    FROM UpcomingVisitors
                    WHERE IsVIP = 1
                ) AS TodayVIPVisitors,
                JSON_QUERY((
                    SELECT
                        DepartmentName,
                        VisitorCount,
                        CheckedInCount,
                        CheckedOutCount
                    FROM DepartmentWise
                    ORDER BY VisitorCount DESC, DepartmentName ASC
                    FOR JSON PATH
                )) AS DepartmentWise,
                JSON_QUERY((
                    SELECT
                        VisitID,
                        PreBookingID,
                        ReferenceCode,
                        VisitorName,
                        VisitorEmail,
                        VisitorMobile,
                        DepartmentName,
                        HostEmployeeName,
                        Purpose,
                        VisitStatus,
                        EntryTime,
                        ExitTime,
                        CreatedAt,
                        IsVIP
                    FROM TodayVisits
                    ORDER BY CreatedAt DESC, VisitID DESC
                    FOR JSON PATH
                )) AS TodayVisitors,
                JSON_QUERY((
                    SELECT
                        PreBookingId,
                        VisitorName,
                        VisitorEmail,
                        VisitorMobile,
                        DepartmentName,
                        HostEmployeeName,
                        VisitDate,
                        RequestStatus,
                        PurposeName,
                        IsVIP
                    FROM UpcomingVisitors
                    ORDER BY VisitorName ASC
                    FOR JSON PATH
                )) AS UpcomingVisitors,
                JSON_QUERY((
                    SELECT
                        PreBookingId,
                        VisitorName,
                        VisitorEmail,
                        VisitorMobile,
                        DepartmentName,
                        HostEmployeeName,
                        VisitDate,
                        RequestStatus,
                        PurposeName,
                        IsVIP
                    FROM AllPrebookings
                    ORDER BY VisitorName ASC
                    FOR JSON PATH
                )) AS AllPrebookings,
                JSON_QUERY((
                    SELECT
                        vip.VisitID,
                        vip.PreBookingID,
                        vip.ReferenceCode,
                        vip.VisitorName,
                        vip.VisitorEmail,
                        vip.VisitorMobile,
                        vip.DepartmentName,
                        vip.HostEmployeeName,
                        vip.Purpose,
                        vip.VisitStatus,
                        vip.EntryTime,
                        vip.ExitTime,
                        vip.CreatedAt,
                        vip.IsVIP
                    FROM (
                        SELECT
                            VisitID,
                            PreBookingID,
                            ReferenceCode,
                            VisitorName,
                            VisitorEmail,
                            VisitorMobile,
                            DepartmentName,
                            HostEmployeeName,
                            Purpose,
                            VisitStatus,
                            EntryTime,
                            ExitTime,
                            CreatedAt,
                            IsVIP
                        FROM TodayVisits
                        WHERE IsVIP = 1

                        UNION ALL

                        SELECT
                            NULL AS VisitID,
                            PreBookingId AS PreBookingID,
                            NULL AS ReferenceCode,
                            VisitorName,
                            VisitorEmail,
                            VisitorMobile,
                            DepartmentName,
                            HostEmployeeName,
                            PurposeName AS Purpose,
                            RequestStatus AS VisitStatus,
                            NULL AS EntryTime,
                            NULL AS ExitTime,
                            NULL AS CreatedAt,
                            IsVIP
                        FROM UpcomingVisitors
                        WHERE IsVIP = 1
                    ) AS vip
                    FOR JSON PATH
                )) AS VIPVisitors
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
END;
GO
