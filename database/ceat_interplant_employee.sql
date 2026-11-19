-- ============================================================
-- CEAT INTER-PLANT EMPLOYEE VISIT - DATABASE SETUP
-- ============================================================
USE [main]
GO

IF OBJECT_ID('dbo.CEAT_INTERPLANT_REQUEST', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CEAT_INTERPLANT_REQUEST (
        request_id INT IDENTITY(1,1) PRIMARY KEY,
        request_token NVARCHAR(80) NOT NULL UNIQUE,
        check_in_date DATE NOT NULL,
        ceat_employee_id NVARCHAR(60) NOT NULL,
        purpose_of_visit NVARCHAR(120) NOT NULL,
        visitor_name NVARCHAR(150) NOT NULL,
        company_location NVARCHAR(150) NOT NULL,
        visitor_mobile NVARCHAR(20) NOT NULL,
        visitor_email NVARCHAR(150) NOT NULL,
        visitor_photo_base64 NVARCHAR(MAX) NULL,
        approver_employee_id INT NOT NULL,
        request_status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        approval_remarks NVARCHAR(500) NULL,
        approved_at DATETIME NULL,
        approved_by INT NULL,
        rejected_at DATETIME NULL,
        rejected_by INT NULL,
        visit_id INT NULL,
        reference_code NVARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        created_by NVARCHAR(80) NULL,
        updated_at DATETIME NULL,
        CONSTRAINT FK_CEAT_INTERPLANT_APPROVER FOREIGN KEY (approver_employee_id) REFERENCES dbo.EMPLOYEE_MASTER(employee_id),
        CONSTRAINT FK_CEAT_INTERPLANT_VISIT FOREIGN KEY (visit_id) REFERENCES dbo.VISIT_TRANSACTION(VisitID),
        CONSTRAINT CHK_CEAT_INTERPLANT_STATUS CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED'))
    );

    CREATE INDEX IX_CEAT_INTERPLANT_STATUS ON dbo.CEAT_INTERPLANT_REQUEST(request_status);
    CREATE INDEX IX_CEAT_INTERPLANT_APPROVER ON dbo.CEAT_INTERPLANT_REQUEST(approver_employee_id);
    CREATE INDEX IX_CEAT_INTERPLANT_DATE ON dbo.CEAT_INTERPLANT_REQUEST(check_in_date);
END
GO

IF COL_LENGTH('dbo.CEAT_INTERPLANT_REQUEST', 'visitor_photo_base64') IS NULL
BEGIN
    ALTER TABLE dbo.CEAT_INTERPLANT_REQUEST
    ADD visitor_photo_base64 NVARCHAR(MAX) NULL;
END
GO

IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'CEAT_INTERPLANT_REQUEST'
      AND COLUMN_NAME = 'visitor_email'
      AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE dbo.CEAT_INTERPLANT_REQUEST
    ALTER COLUMN visitor_email NVARCHAR(150) NULL;
END
GO

CREATE OR ALTER PROCEDURE dbo.CeatInterplant_Create_SP
    @XMLData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = CAST(@XMLData AS XML);
        DECLARE @CheckInDate DATE = @xml.value('(/CeatInterplant/CheckInDate)[1]', 'DATE');
        DECLARE @EmployeeId NVARCHAR(60) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/EmployeeId)[1]', 'NVARCHAR(60)'))), '');
        DECLARE @PurposeOfVisit NVARCHAR(120) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/PurposeOfVisit)[1]', 'NVARCHAR(120)'))), '');
        DECLARE @VisitorName NVARCHAR(150) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/VisitorName)[1]', 'NVARCHAR(150)'))), '');
        DECLARE @CompanyLocation NVARCHAR(150) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/CompanyLocation)[1]', 'NVARCHAR(150)'))), '');
        DECLARE @VisitorMobile NVARCHAR(20) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/VisitorMobile)[1]', 'NVARCHAR(20)'))), '');
        DECLARE @VisitorEmail NVARCHAR(150) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/VisitorEmail)[1]', 'NVARCHAR(150)'))), '');
        DECLARE @VisitorPhotoBase64 NVARCHAR(MAX) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/VisitorPhotoBase64)[1]', 'NVARCHAR(MAX)'))), '');
        DECLARE @ApproverEmployeeId INT = @xml.value('(/CeatInterplant/ApproverEmployeeId)[1]', 'INT');

        IF @CheckInDate IS NULL OR @CheckInDate = '1900-01-01'
        BEGIN
            SELECT (SELECT 'E' AS Success, 'Check-in date is required.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        IF @EmployeeId IS NULL OR @PurposeOfVisit IS NULL OR @VisitorName IS NULL OR @CompanyLocation IS NULL OR @VisitorMobile IS NULL OR @ApproverEmployeeId IS NULL OR @ApproverEmployeeId <= 0
        BEGIN
            SELECT (SELECT 'E' AS Success, 'Please fill all mandatory fields.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        DECLARE @Token NVARCHAR(80) = LOWER(REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', ''));

        INSERT INTO dbo.CEAT_INTERPLANT_REQUEST (
            request_token,
            check_in_date,
            ceat_employee_id,
            purpose_of_visit,
            visitor_name,
            company_location,
            visitor_mobile,
            visitor_email,
            visitor_photo_base64,
            approver_employee_id,
            request_status,
            created_at,
            created_by
        ) VALUES (
            @Token,
            @CheckInDate,
            @EmployeeId,
            @PurposeOfVisit,
            @VisitorName,
            @CompanyLocation,
            @VisitorMobile,
            @VisitorEmail,
            @VisitorPhotoBase64,
            @ApproverEmployeeId,
            'PENDING',
            GETDATE(),
            'PUBLIC'
        );

        DECLARE @RequestId INT = SCOPE_IDENTITY();

        SELECT (
            SELECT
                'S' AS Success,
                'Request submitted and sent for approval.' AS Message,
                @RequestId AS RequestId,
                @Token AS Token,
                'PENDING' AS Status
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (SELECT 'E' AS Success, ERROR_MESSAGE() AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.CeatInterplant_Lookups_SP
    @XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        SELECT (
            SELECT
                'S' AS Success,
                'Lookups fetched.' AS Message,
                JSON_QUERY((
                    SELECT
                        e.employee_id AS EmployeeId,
                        e.name AS EmployeeName,
                        d.name AS DepartmentName,
                        e.designation
                    FROM dbo.employee_master e
                    LEFT JOIN dbo.department_master d ON d.department_id = e.department_id
                    WHERE ISNULL(e.is_active, 1) = 1
                    ORDER BY e.name ASC
                    FOR JSON PATH
                )) AS Approvers
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (SELECT 'E' AS Success, ERROR_MESSAGE() AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.CeatInterplant_Status_ByToken_SP
    @XMLData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = CAST(@XMLData AS XML);
        DECLARE @Token NVARCHAR(80) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/Token)[1]', 'NVARCHAR(80)'))), '');

        IF @Token IS NULL
        BEGIN
            SELECT (SELECT 'E' AS Success, 'Token is required.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        SELECT (
            SELECT TOP 1
                'S' AS Success,
                'Status fetched.' AS Message,
                cir.request_id AS RequestId,
                cir.request_token AS Token,
                cir.request_status AS RequestStatus,
                cir.check_in_date AS CheckInDate,
                cir.ceat_employee_id AS EmployeeId,
                cir.purpose_of_visit AS PurposeOfVisit,
                cir.visitor_name AS VisitorName,
                cir.company_location AS CompanyLocation,
                cir.visitor_mobile AS VisitorMobile,
                cir.visitor_email AS VisitorEmail,
                cir.visitor_photo_base64 AS VisitorPhotoBase64,
                cir.reference_code AS ReferenceCode,
                cir.approval_remarks AS ApprovalRemarks,
                cir.visit_id AS VisitID,
                vt.VisitStatus,
                vt.EntryTime,
                vt.ExitTime,
                CASE
                    WHEN cir.request_status = 'APPROVED' AND ISNULL(vt.VisitStatus, 'PENDING_ENTRY') NOT IN ('CHECKED_OUT', 'COMPLETED') THEN 1
                    ELSE 0
                END AS ShowGatePass,
                em.name AS ApproverName
            FROM dbo.CEAT_INTERPLANT_REQUEST cir
            LEFT JOIN dbo.VISIT_TRANSACTION vt ON vt.VisitID = cir.visit_id
            LEFT JOIN dbo.employee_master em ON em.employee_id = cir.approver_employee_id
            WHERE cir.request_token = @Token
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (SELECT 'E' AS Success, ERROR_MESSAGE() AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.CeatInterplant_Pending_ForApprover_SP
    @XMLData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = CAST(@XMLData AS XML);
        DECLARE @ApproverEmployeeId INT = @xml.value('(/CeatInterplant/ApproverEmployeeId)[1]', 'INT');

        IF @ApproverEmployeeId IS NULL OR @ApproverEmployeeId <= 0
        BEGIN
            SELECT (SELECT 'E' AS Success, 'ApproverEmployeeId is required.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        SELECT (
            SELECT
                'S' AS Success,
                'Pending requests fetched.' AS Message,
                JSON_QUERY((
                    SELECT
                        request_id AS RequestId,
                        request_token AS Token,
                        check_in_date AS CheckInDate,
                        ceat_employee_id AS EmployeeId,
                        purpose_of_visit AS PurposeOfVisit,
                        visitor_name AS VisitorName,
                        company_location AS CompanyLocation,
                        visitor_mobile AS VisitorMobile,
                        visitor_email AS VisitorEmail,
                        created_at AS CreatedAt
                    FROM dbo.CEAT_INTERPLANT_REQUEST
                    WHERE approver_employee_id = @ApproverEmployeeId
                      AND request_status = 'PENDING'
                    ORDER BY created_at DESC
                    FOR JSON PATH
                )) AS Items
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (SELECT 'E' AS Success, ERROR_MESSAGE() AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.CeatInterplant_Decision_SP
    @XMLData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = CAST(@XMLData AS XML);
        DECLARE @RequestId INT = @xml.value('(/CeatInterplant/RequestId)[1]', 'INT');
        DECLARE @Action NVARCHAR(20) = UPPER(NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/Action)[1]', 'NVARCHAR(20)'))), ''));
        DECLARE @Remarks NVARCHAR(500) = NULLIF(LTRIM(RTRIM(@xml.value('(/CeatInterplant/Remarks)[1]', 'NVARCHAR(500)'))), '');
        DECLARE @ApproverEmployeeId INT = @xml.value('(/CeatInterplant/ApproverEmployeeId)[1]', 'INT');

        IF @RequestId IS NULL OR @RequestId <= 0 OR @ApproverEmployeeId IS NULL OR @ApproverEmployeeId <= 0 OR @Action NOT IN ('APPROVED', 'REJECTED')
        BEGIN
            SELECT (SELECT 'E' AS Success, 'RequestId, ApproverEmployeeId and valid Action are required.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        DECLARE @CurrentStatus NVARCHAR(20);
        DECLARE @CheckInDate DATE;
        DECLARE @EmployeeId NVARCHAR(60);
        DECLARE @Purpose NVARCHAR(120);
        DECLARE @VisitorName NVARCHAR(150);
        DECLARE @Location NVARCHAR(150);
        DECLARE @VisitorMobile NVARCHAR(20);
        DECLARE @VisitorEmail NVARCHAR(150);
        DECLARE @VisitorPhotoBase64 NVARCHAR(MAX);

        SELECT
            @CurrentStatus = request_status,
            @CheckInDate = check_in_date,
            @EmployeeId = ceat_employee_id,
            @Purpose = purpose_of_visit,
            @VisitorName = visitor_name,
            @Location = company_location,
            @VisitorMobile = visitor_mobile,
                        @VisitorEmail = visitor_email,
                        @VisitorPhotoBase64 = visitor_photo_base64
        FROM dbo.CEAT_INTERPLANT_REQUEST
        WHERE request_id = @RequestId
          AND approver_employee_id = @ApproverEmployeeId;

        IF @CurrentStatus IS NULL
        BEGIN
            SELECT (SELECT 'E' AS Success, 'Request not found for approver.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        IF @CurrentStatus <> 'PENDING'
        BEGIN
            SELECT (SELECT 'E' AS Success, 'Request already processed.' AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
            RETURN;
        END;

        IF @Action = 'REJECTED'
        BEGIN
            UPDATE dbo.CEAT_INTERPLANT_REQUEST
            SET request_status = 'REJECTED',
                approval_remarks = @Remarks,
                rejected_at = GETDATE(),
                rejected_by = @ApproverEmployeeId,
                updated_at = GETDATE()
            WHERE request_id = @RequestId;

            SELECT (
                SELECT 'S' AS Success, 'Request rejected.' AS Message, 'REJECTED' AS Status
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            ) AS ReturnValue;
            RETURN;
        END;

        DECLARE @DeptName NVARCHAR(100) = NULL;
        DECLARE @HostName NVARCHAR(100) = NULL;
        DECLARE @HostMobile NVARCHAR(20) = NULL;

        SELECT TOP 1
            @DeptName = d.name,
            @HostName = e.name,
            @HostMobile = e.mobile
        FROM dbo.employee_master e
        LEFT JOIN dbo.department_master d ON d.department_id = e.department_id
        WHERE e.employee_id = @ApproverEmployeeId;

        DECLARE @VisitID INT;
        DECLARE @ReferenceCode NVARCHAR(50);
        DECLARE @Sequence INT = ABS(CHECKSUM(NEWID())) % 1000000;
        SET @ReferenceCode = 'CEP-' + FORMAT(GETDATE(), 'yyMMdd') + '-' + RIGHT('000000' + CAST(@Sequence AS NVARCHAR(6)), 6);

        WHILE EXISTS (SELECT 1 FROM dbo.VISIT_TRANSACTION WHERE ReferenceCode = @ReferenceCode)
        BEGIN
            SET @Sequence = ABS(CHECKSUM(NEWID())) % 1000000;
            SET @ReferenceCode = 'CEP-' + FORMAT(GETDATE(), 'yyMMdd') + '-' + RIGHT('000000' + CAST(@Sequence AS NVARCHAR(6)), 6);
        END;

        BEGIN TRANSACTION;

        INSERT INTO dbo.VISIT_TRANSACTION (
            PreBookingID,
            VisitorName,
            VisitorEmail,
            VisitorMobile,
            VisitorPhotoBase64,
            VisitType,
            Purpose,
            HostEmployeeID,
            HostEmployeeName,
            HostEmployeeMobile,
            DepartmentID,
            DepartmentName,
            ApprovalStatus,
            ApprovedBy,
            ApprovedAt,
            ReferenceCode,
            GatePassGeneratedAt,
            GatePassValidTill,
            VisitStatus,
            EntryGate,
            ExitGate,
            PPERequired,
            PPEItems,
            ReturnedPPEItems,
            CreatedAt,
            CreatedBy,
            UpdatedAt,
            UpdatedBy,
            Notes
        ) VALUES (
            0,
            @VisitorName,
            ISNULL(@VisitorEmail, ''),
            @VisitorMobile,
            @VisitorPhotoBase64,
            'CEAT_INTERPLANT',
            @Purpose,
            @ApproverEmployeeId,
            ISNULL(@HostName, 'Approver'),
            ISNULL(@HostMobile, ''),
            NULL,
            ISNULL(@DeptName, @Location),
            'APPROVED',
            @ApproverEmployeeId,
            GETDATE(),
            @ReferenceCode,
            GETDATE(),
            @CheckInDate,
            'PENDING_ENTRY',
            NULL,
            NULL,
            0,
            NULL,
            NULL,
            GETDATE(),
            @ApproverEmployeeId,
            NULL,
            NULL,
            CONCAT('CEAT Inter-Plant request approved. Employee ID: ', @EmployeeId, ', Location: ', @Location)
        );

        SET @VisitID = SCOPE_IDENTITY();

        UPDATE dbo.CEAT_INTERPLANT_REQUEST
        SET request_status = 'APPROVED',
            approval_remarks = @Remarks,
            approved_at = GETDATE(),
            approved_by = @ApproverEmployeeId,
            visit_id = @VisitID,
            reference_code = @ReferenceCode,
            updated_at = GETDATE()
        WHERE request_id = @RequestId;

        INSERT INTO dbo.VISIT_AUDIT_LOG (VisitID, Action, Details, ActionBy)
        VALUES (@VisitID, 'CEAT_INTERPLANT_APPROVED', 'Approved CEAT inter-plant request and issued gate pass.', @ApproverEmployeeId);

        COMMIT TRANSACTION;

        SELECT (
            SELECT
                'S' AS Success,
                'Request approved and gate pass generated.' AS Message,
                'APPROVED' AS Status,
                @VisitID AS VisitID,
                @ReferenceCode AS ReferenceCode
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT (SELECT 'E' AS Success, ERROR_MESSAGE() AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.CeatInterplant_Dashboard_List_SP
    @XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @ForDate DATE = CONVERT(DATE, GETDATE());

        IF @XMLData IS NOT NULL AND LTRIM(RTRIM(@XMLData)) <> ''
        BEGIN
            DECLARE @xml XML = CAST(@XMLData AS XML);
            DECLARE @InputDate DATE = @xml.value('(/CeatInterplant/ForDate)[1]', 'DATE');
            IF @InputDate IS NOT NULL AND @InputDate <> '1900-01-01'
                SET @ForDate = @InputDate;
        END;

        SELECT (
            SELECT
                'S' AS Success,
                'Dashboard entries fetched.' AS Message,
                JSON_QUERY((
                    SELECT
                        cir.request_id AS RequestId,
                        cir.check_in_date AS CheckInDate,
                        cir.ceat_employee_id AS EmployeeId,
                        cir.purpose_of_visit AS PurposeOfVisit,
                        cir.visitor_name AS VisitorName,
                        cir.company_location AS CompanyLocation,
                        cir.visitor_mobile AS VisitorMobile,
                        cir.visitor_email AS VisitorEmail,
                        cir.request_status AS RequestStatus,
                        cir.reference_code AS ReferenceCode,
                        cir.created_at AS CreatedAt,
                        vt.VisitStatus,
                        vt.EntryTime,
                        vt.ExitTime,
                        em.name AS ApproverName
                    FROM dbo.CEAT_INTERPLANT_REQUEST cir
                    LEFT JOIN dbo.VISIT_TRANSACTION vt ON vt.VisitID = cir.visit_id
                    LEFT JOIN dbo.employee_master em ON em.employee_id = cir.approver_employee_id
                    WHERE cir.check_in_date = @ForDate
                    ORDER BY cir.created_at DESC
                    FOR JSON PATH
                )) AS Items,
                @ForDate AS ForDate
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (SELECT 'E' AS Success, ERROR_MESSAGE() AS Message FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS ReturnValue;
    END CATCH;
END
GO
