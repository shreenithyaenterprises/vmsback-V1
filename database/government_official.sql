-- ============================================================
-- GOVERNMENT OFFICIAL ENTRY - DATABASE SETUP
-- ============================================================
-- Adds direct security-managed Government Official entry flow
-- without approval dependency.
-- ============================================================

USE [main]
GO

IF OBJECT_ID('dbo.GOVERNMENT_OFFICIAL_ENTRY', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GOVERNMENT_OFFICIAL_ENTRY (
        entry_id INT IDENTITY(1,1) PRIMARY KEY,
        visit_id INT NOT NULL,
        user_department NVARCHAR(100) NOT NULL,
        official_type NVARCHAR(100) NOT NULL,
        purpose_of_visit NVARCHAR(500) NOT NULL,
        current_status NVARCHAR(30) NOT NULL DEFAULT 'PENDING_ENTRY',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        created_by INT NULL,
        updated_at DATETIME NULL,
        updated_by INT NULL,
        CONSTRAINT FK_GOV_OFFICIAL_VISIT FOREIGN KEY (visit_id) REFERENCES dbo.VISIT_TRANSACTION(VisitID),
        CONSTRAINT CHK_GOV_OFFICIAL_STATUS CHECK (current_status IN ('PENDING_ENTRY', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'))
    );

    CREATE UNIQUE INDEX UX_GOV_OFFICIAL_VISIT_ID ON dbo.GOVERNMENT_OFFICIAL_ENTRY(visit_id);
    CREATE INDEX IX_GOV_OFFICIAL_CREATED_AT ON dbo.GOVERNMENT_OFFICIAL_ENTRY(created_at);
    CREATE INDEX IX_GOV_OFFICIAL_STATUS ON dbo.GOVERNMENT_OFFICIAL_ENTRY(current_status);

    PRINT 'CREATE TABLE GOVERNMENT_OFFICIAL_ENTRY - SUCCESS';
END
ELSE
BEGIN
    PRINT 'TABLE GOVERNMENT_OFFICIAL_ENTRY ALREADY EXISTS';
END
GO

CREATE OR ALTER PROCEDURE dbo.GovernmentOfficial_Create_SP
    @XMLData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = CAST(@XMLData AS XML);
        DECLARE @UserDepartment NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/UserDepartment)[1]', 'NVARCHAR(100)'))), '');
        DECLARE @OfficialType NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/OfficialType)[1]', 'NVARCHAR(100)'))), '');
        DECLARE @PurposeOfVisit NVARCHAR(500) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/PurposeOfVisit)[1]', 'NVARCHAR(500)'))), '');
        DECLARE @VisitorEmail NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/VisitorEmail)[1]', 'NVARCHAR(100)'))), '');
        DECLARE @VisitorMobile NVARCHAR(20) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/VisitorMobile)[1]', 'NVARCHAR(20)'))), '');
        DECLARE @CreatedBy INT = NULL;

        DECLARE @CreatedByRaw NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/CreatedBy)[1]', 'NVARCHAR(30)'))), '');
        IF @CreatedByRaw IS NOT NULL AND TRY_CONVERT(INT, @CreatedByRaw) IS NOT NULL
            SET @CreatedBy = TRY_CONVERT(INT, @CreatedByRaw);

        IF @UserDepartment IS NULL OR @OfficialType IS NULL OR @PurposeOfVisit IS NULL
        BEGIN
            SELECT (
                SELECT 'E' AS Success, 'UserDepartment, OfficialType, and PurposeOfVisit are required.' AS Message
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            ) AS ReturnValue;
            RETURN;
        END;

        IF @VisitorEmail IS NULL
            SET @VisitorEmail = '';

        IF @VisitorMobile IS NULL
            SET @VisitorMobile = '';

        DECLARE @VisitID INT;
        DECLARE @ReferenceCode NVARCHAR(50);
        DECLARE @Sequence INT = ABS(CHECKSUM(NEWID())) % 1000000;

        SET @ReferenceCode = 'GOV-' + FORMAT(GETDATE(), 'yyMMdd') + '-' + RIGHT('000000' + CAST(@Sequence AS NVARCHAR(6)), 6);

        WHILE EXISTS (SELECT 1 FROM dbo.VISIT_TRANSACTION WHERE ReferenceCode = @ReferenceCode)
        BEGIN
            SET @Sequence = ABS(CHECKSUM(NEWID())) % 1000000;
            SET @ReferenceCode = 'GOV-' + FORMAT(GETDATE(), 'yyMMdd') + '-' + RIGHT('000000' + CAST(@Sequence AS NVARCHAR(6)), 6);
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
            @OfficialType,
            @VisitorEmail,
            @VisitorMobile,
            NULL,
            'GOVERNMENT_OFFICIAL',
            @PurposeOfVisit,
            0,
            'Security Desk',
            '',
            NULL,
            @UserDepartment,
            'APPROVED',
            @CreatedBy,
            GETDATE(),
            @ReferenceCode,
            GETDATE(),
            CONVERT(DATE, GETDATE()),
            'PENDING_ENTRY',
            NULL,
            NULL,
            0,
            NULL,
            NULL,
            GETDATE(),
            @CreatedBy,
            NULL,
            NULL,
            'Government official direct security entry'
        );

        SET @VisitID = SCOPE_IDENTITY();

        INSERT INTO dbo.GOVERNMENT_OFFICIAL_ENTRY (
            visit_id,
            user_department,
            official_type,
            purpose_of_visit,
            current_status,
            created_at,
            created_by
        ) VALUES (
            @VisitID,
            @UserDepartment,
            @OfficialType,
            @PurposeOfVisit,
            'PENDING_ENTRY',
            GETDATE(),
            @CreatedBy
        );

        INSERT INTO dbo.VISIT_AUDIT_LOG (VisitID, Action, Details, ActionBy)
        VALUES (
            @VisitID,
            'GOV_OFFICIAL_CREATED',
            CONCAT('Government official entry created. Department: ', @UserDepartment, ', Type: ', @OfficialType),
            @CreatedBy
        );

        COMMIT TRANSACTION;

        SELECT (
            SELECT
                'S' AS Success,
                'Government official request created and sent to security dashboard.' AS Message,
                @VisitID AS VisitID,
                @ReferenceCode AS ReferenceCode,
                @UserDepartment AS UserDepartment,
                @OfficialType AS OfficialType,
                @PurposeOfVisit AS PurposeOfVisit,
                'PENDING_ENTRY' AS VisitStatus
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SELECT (
            SELECT 'E' AS Success, ERROR_MESSAGE() AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.GovernmentOfficial_Today_List_SP
    @XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @ForDate DATE = CONVERT(DATE, GETDATE());

        IF @XMLData IS NOT NULL AND LTRIM(RTRIM(@XMLData)) <> ''
        BEGIN
            DECLARE @xml XML = CAST(@XMLData AS XML);
            DECLARE @InputDate DATE = @xml.value('(/GovernmentOfficial/ForDate)[1]', 'DATE');
            IF @InputDate = '1900-01-01'
                SET @InputDate = NULL;
            IF @InputDate IS NOT NULL
                SET @ForDate = @InputDate;
        END;

        SELECT (
            SELECT
                'S' AS Success,
                'Government official entries fetched.' AS Message,
                JSON_QUERY((
                    SELECT
                        ge.entry_id AS EntryId,
                        ge.visit_id AS VisitID,
                        vt.ReferenceCode,
                        ge.user_department AS UserDepartment,
                        ge.official_type AS OfficialType,
                        ge.purpose_of_visit AS PurposeOfVisit,
                        vt.VisitStatus,
                        vt.EntryTime,
                        vt.ExitTime,
                        ge.created_at AS CreatedAt,
                        vt.EntryGate,
                        vt.ExitGate
                    FROM dbo.GOVERNMENT_OFFICIAL_ENTRY ge
                    INNER JOIN dbo.VISIT_TRANSACTION vt ON vt.VisitID = ge.visit_id
                    WHERE CONVERT(DATE, ge.created_at) = @ForDate
                    ORDER BY ge.created_at DESC, ge.entry_id DESC
                    FOR JSON PATH
                )) AS Items,
                @ForDate AS ForDate
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (
            SELECT 'E' AS Success, ERROR_MESSAGE() AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END CATCH;
END
GO

CREATE OR ALTER PROCEDURE dbo.GovernmentOfficial_Status_Sync_SP
    @XMLData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @xml XML = CAST(@XMLData AS XML);
        DECLARE @VisitID INT = @xml.value('(/GovernmentOfficial/VisitID)[1]', 'INT');
        DECLARE @VisitStatus NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/VisitStatus)[1]', 'NVARCHAR(30)'))), '');
        DECLARE @UpdatedBy INT = NULL;
        DECLARE @UpdatedByRaw NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@xml.value('(/GovernmentOfficial/UpdatedBy)[1]', 'NVARCHAR(30)'))), '');

        IF @UpdatedByRaw IS NOT NULL AND TRY_CONVERT(INT, @UpdatedByRaw) IS NOT NULL
            SET @UpdatedBy = TRY_CONVERT(INT, @UpdatedByRaw);

        IF @VisitID IS NULL OR @VisitID <= 0 OR @VisitStatus IS NULL
        BEGIN
            SELECT (
                SELECT 'E' AS Success, 'VisitID and VisitStatus are required.' AS Message
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            ) AS ReturnValue;
            RETURN;
        END;

        UPDATE dbo.GOVERNMENT_OFFICIAL_ENTRY
        SET
            current_status = @VisitStatus,
            updated_at = GETDATE(),
            updated_by = @UpdatedBy
        WHERE visit_id = @VisitID;

        SELECT (
            SELECT 'S' AS Success, 'Government official status synced.' AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END TRY
    BEGIN CATCH
        SELECT (
            SELECT 'E' AS Success, ERROR_MESSAGE() AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END CATCH;
END
GO
