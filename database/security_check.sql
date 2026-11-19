-- ============================================================
-- SECURITY MANUAL CHECK - DATABASE SETUP
-- ============================================================
-- This SQL script creates tables and stored procedures
-- for the Security Manual Check feature
-- ============================================================

-- ============================================================
-- 1. CREATE TABLE: SECURITY_CHECK_REQUEST
-- ============================================================
IF OBJECT_ID('dbo.SECURITY_CHECK_REQUEST', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SECURITY_CHECK_REQUEST (
        security_check_id INT IDENTITY(1,1) PRIMARY KEY,
        visitor_name NVARCHAR(255) NOT NULL,
        visitor_email NVARCHAR(255) NOT NULL,
        visitor_mobile NVARCHAR(20) NOT NULL,
        visitor_company NVARCHAR(255),
        visit_purpose NVARCHAR(500),
        id_proof_type NVARCHAR(50),
        id_proof_number NVARCHAR(100),
        visitor_remarks NVARCHAR(1000),
        visitor_photo_base64 NVARCHAR(MAX),
        host_employee_id INT NOT NULL,
        approver_id INT NOT NULL,
        approval_status NVARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
        approval_remarks NVARCHAR(1000),
        reference_code NVARCHAR(100) UNIQUE,
        gate_pass_qr_base64 NVARCHAR(MAX),
        visit_transaction_id INT,
        created_at DATETIME DEFAULT GETDATE(),
        created_by NVARCHAR(50),
        approved_at DATETIME,
        approved_by NVARCHAR(50),
        sent_gate_pass_at DATETIME,
        cancelled_at DATETIME,
        cancelled_by NVARCHAR(50),
        
        CONSTRAINT FK_SECURITY_HOST_EMP FOREIGN KEY (host_employee_id) 
            REFERENCES EMPLOYEE_MASTER(employee_id),
        CONSTRAINT FK_SECURITY_APPROVER FOREIGN KEY (approver_id) 
            REFERENCES EMPLOYEE_MASTER(employee_id),
        CONSTRAINT FK_SECURITY_CREATED_BY FOREIGN KEY (created_by) 
            REFERENCES dbo.user_profile(user_id),
        CONSTRAINT FK_SECURITY_APPROVED_BY FOREIGN KEY (approved_by) 
            REFERENCES dbo.user_profile(user_id),
        CONSTRAINT FK_SECURITY_CANCELLED_BY FOREIGN KEY (cancelled_by) 
            REFERENCES dbo.user_profile(user_id),
        CONSTRAINT FK_SECURITY_VISIT_TXN FOREIGN KEY (visit_transaction_id) 
            REFERENCES dbo.VISIT_TRANSACTION(VisitID)
    );

    CREATE INDEX IDX_SECURITY_STATUS ON dbo.SECURITY_CHECK_REQUEST(approval_status);
    CREATE INDEX IDX_SECURITY_APPROVER ON dbo.SECURITY_CHECK_REQUEST(approver_id);
    CREATE INDEX IDX_SECURITY_HOST ON dbo.SECURITY_CHECK_REQUEST(host_employee_id);
    CREATE INDEX IDX_SECURITY_EMAIL ON dbo.SECURITY_CHECK_REQUEST(visitor_email);
    CREATE INDEX IDX_SECURITY_REFCODE ON dbo.SECURITY_CHECK_REQUEST(reference_code);
    CREATE INDEX IDX_SECURITY_CREATED_AT ON dbo.SECURITY_CHECK_REQUEST(created_at);

    PRINT 'CREATE TABLE SECURITY_CHECK_REQUEST - SUCCESS';
END
ELSE
BEGIN
    PRINT 'TABLE SECURITY_CHECK_REQUEST ALREADY EXISTS';
END
GO

-- ============================================================
-- 2. CREATE TABLE: SECURITY_CHECK_AUDIT_LOG
-- ============================================================
IF OBJECT_ID('dbo.SECURITY_CHECK_AUDIT_LOG', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SECURITY_CHECK_AUDIT_LOG (
        audit_id INT IDENTITY(1,1) PRIMARY KEY,
        security_check_id INT NOT NULL,
        action_type NVARCHAR(50) NOT NULL, -- CREATED, SUBMITTED, APPROVED, REJECTED, GATE_PASS_SENT, CHECKED_IN, CHECKED_OUT
        action_by NVARCHAR(50),
        action_at DATETIME DEFAULT GETDATE(),
        action_remarks NVARCHAR(500),
        
        CONSTRAINT FK_AUDIT_SECURITY_CHECK FOREIGN KEY (security_check_id) 
            REFERENCES dbo.SECURITY_CHECK_REQUEST(security_check_id) ON DELETE CASCADE,
        CONSTRAINT FK_AUDIT_USER FOREIGN KEY (action_by) 
            REFERENCES dbo.user_profile(user_id)
    );

    CREATE INDEX IDX_AUDIT_SECURITY_ID ON dbo.SECURITY_CHECK_AUDIT_LOG(security_check_id);
    CREATE INDEX IDX_AUDIT_ACTION_TYPE ON dbo.SECURITY_CHECK_AUDIT_LOG(action_type);
    CREATE INDEX IDX_AUDIT_CREATED_AT ON dbo.SECURITY_CHECK_AUDIT_LOG(action_at);

    PRINT 'CREATE TABLE SECURITY_CHECK_AUDIT_LOG - SUCCESS';
END
ELSE
BEGIN
    PRINT 'TABLE SECURITY_CHECK_AUDIT_LOG ALREADY EXISTS';
END
GO

-- ============================================================
-- 3. STORED PROCEDURE: SecurityCheck_Create_SP
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SecurityCheck_Create_SP
    @VisitorName NVARCHAR(255),
    @VisitorEmail NVARCHAR(255),
    @VisitorMobile NVARCHAR(20),
    @VisitorCompany NVARCHAR(255) = NULL,
    @VisitPurpose NVARCHAR(500) = NULL,
    @IdProofType NVARCHAR(50) = NULL,
    @IdProofNumber NVARCHAR(100) = NULL,
    @VisitorRemarks NVARCHAR(1000) = NULL,
    @VisitorPhotoBase64 NVARCHAR(MAX) = NULL,
    @HostEmployeeId INT,
    @ApproverId INT,
    @CreatedBy INT = NULL,
    @ReferenceCode NVARCHAR(100) OUTPUT,
    @SecurityCheckId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Generate unique reference code
        SET @ReferenceCode = 'SEC-' + FORMAT(GETDATE(), 'yyMMdd-') + FORMAT(ABS(CHECKSUM(NEWID()) % 1000000), '000000');

        -- Insert security check request
        INSERT INTO dbo.SECURITY_CHECK_REQUEST (
            visitor_name,
            visitor_email,
            visitor_mobile,
            visitor_company,
            visit_purpose,
            id_proof_type,
            id_proof_number,
            visitor_remarks,
            visitor_photo_base64,
            host_employee_id,
            approver_id,
            reference_code,
            created_by
        ) VALUES (
            @VisitorName,
            @VisitorEmail,
            @VisitorMobile,
            @VisitorCompany,
            @VisitPurpose,
            @IdProofType,
            @IdProofNumber,
            @VisitorRemarks,
            @VisitorPhotoBase64,
            @HostEmployeeId,
            @ApproverId,
            @ReferenceCode,
            @CreatedBy
        );

        SET @SecurityCheckId = SCOPE_IDENTITY();

        -- Log audit entry
        INSERT INTO dbo.SECURITY_CHECK_AUDIT_LOG (
            security_check_id,
            action_type,
            action_by,
            action_remarks
        ) VALUES (
            @SecurityCheckId,
            'CREATED',
            @CreatedBy,
            'Visitor entry submitted for security check'
        );

        COMMIT TRANSACTION;

        SELECT 
            @SecurityCheckId AS security_check_id,
            @ReferenceCode AS reference_code,
            GETDATE() AS created_at,
            'SUCCESS' AS status,
            'Security check request created successfully' AS message;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        
        SELECT 
            -1 AS security_check_id,
            NULL AS reference_code,
            NULL AS created_at,
            'ERROR' AS status,
            ERROR_MESSAGE() AS message;
    END CATCH;
END
GO

-- ============================================================
-- 4. STORED PROCEDURE: SecurityCheck_Get_SP
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SecurityCheck_Get_SP
    @SecurityCheckId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        scr.security_check_id,
        scr.visitor_name,
        scr.visitor_email,
        scr.visitor_mobile,
        scr.visitor_company,
        scr.visit_purpose,
        scr.id_proof_type,
        scr.id_proof_number,
        scr.visitor_remarks,
        scr.visitor_photo_base64,
        scr.host_employee_id,
        hem.name AS host_employee_name,
        scr.approver_id,
        aem.name AS approver_name,
        scr.approval_status,
        scr.approval_remarks,
        scr.reference_code,
        scr.gate_pass_qr_base64,
        scr.created_at,
        scr.approved_at,
        scr.sent_gate_pass_at
    FROM dbo.SECURITY_CHECK_REQUEST scr
    LEFT JOIN dbo.EMPLOYEE_MASTER hem ON scr.host_employee_id = hem.employee_id
    LEFT JOIN dbo.EMPLOYEE_MASTER aem ON scr.approver_id = aem.employee_id
    WHERE scr.security_check_id = @SecurityCheckId;

END
GO

-- ============================================================
-- 5. STORED PROCEDURE: SecurityCheck_ListPending_SP
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SecurityCheck_ListPending_SP
    @ApproverId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        scr.security_check_id,
        scr.visitor_name,
        scr.visitor_email,
        scr.visitor_mobile,
        scr.visitor_company,
        scr.visit_purpose,
        scr.host_employee_id,
        hem.name AS host_employee_name,
        hem.department,
        scr.reference_code,
        scr.created_at,
        scr.approval_status
    FROM dbo.SECURITY_CHECK_REQUEST scr
    LEFT JOIN dbo.EMPLOYEE_MASTER hem ON scr.host_employee_id = hem.employee_id
    WHERE scr.approver_id = @ApproverId
        AND scr.approval_status = 'PENDING'
    ORDER BY scr.created_at DESC;

END
GO

-- ============================================================
-- 6. STORED PROCEDURE: SecurityCheck_Approve_SP
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SecurityCheck_Approve_SP
    @SecurityCheckId INT,
    @ApprovedBy INT,
    @ApprovalRemarks NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Update security check request status
        UPDATE dbo.SECURITY_CHECK_REQUEST
        SET 
            approval_status = 'APPROVED',
            approved_at = GETDATE(),
            approved_by = @ApprovedBy,
            approval_remarks = @ApprovalRemarks
        WHERE security_check_id = @SecurityCheckId;

        -- Log audit entry
        INSERT INTO dbo.SECURITY_CHECK_AUDIT_LOG (
            security_check_id,
            action_type,
            action_by,
            action_remarks
        ) VALUES (
            @SecurityCheckId,
            'APPROVED',
            @ApprovedBy,
            @ApprovalRemarks
        );

        -- Generate gate pass (will be done in application layer)
        DECLARE @ReferenceCode NVARCHAR(100);
        SELECT @ReferenceCode = reference_code FROM dbo.SECURITY_CHECK_REQUEST WHERE security_check_id = @SecurityCheckId;

        COMMIT TRANSACTION;

        SELECT 
            @SecurityCheckId AS security_check_id,
            @ReferenceCode AS reference_code,
            'APPROVED' AS approval_status,
            'Security check approved successfully' AS message;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        
        SELECT 
            @SecurityCheckId AS security_check_id,
            NULL AS reference_code,
            'ERROR' AS approval_status,
            ERROR_MESSAGE() AS message;
    END CATCH;
END
GO

-- ============================================================
-- 7. STORED PROCEDURE: SecurityCheck_Reject_SP
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SecurityCheck_Reject_SP
    @SecurityCheckId INT,
    @RejectedBy INT,
    @RejectionRemarks NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Update security check request status
        UPDATE dbo.SECURITY_CHECK_REQUEST
        SET 
            approval_status = 'REJECTED',
            approved_at = GETDATE(),
            approved_by = @RejectedBy,
            approval_remarks = @RejectionRemarks
        WHERE security_check_id = @SecurityCheckId;

        -- Log audit entry
        INSERT INTO dbo.SECURITY_CHECK_AUDIT_LOG (
            security_check_id,
            action_type,
            action_by,
            action_remarks
        ) VALUES (
            @SecurityCheckId,
            'REJECTED',
            @RejectedBy,
            @RejectionRemarks
        );

        COMMIT TRANSACTION;

        SELECT 
            @SecurityCheckId AS security_check_id,
            'REJECTED' AS approval_status,
            'Security check rejected' AS message;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        
        SELECT 
            @SecurityCheckId AS security_check_id,
            'ERROR' AS approval_status,
            ERROR_MESSAGE() AS message;
    END CATCH;
END
GO

-- ============================================================
-- 8. STORED PROCEDURE: SecurityCheck_UpdateGatePass_SP
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SecurityCheck_UpdateGatePass_SP
    @SecurityCheckId INT,
    @GatePassQRBase64 NVARCHAR(MAX),
    @VisitTransactionId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        UPDATE dbo.SECURITY_CHECK_REQUEST
        SET 
            gate_pass_qr_base64 = @GatePassQRBase64,
            visit_transaction_id = @VisitTransactionId,
            sent_gate_pass_at = GETDATE()
        WHERE security_check_id = @SecurityCheckId;

        -- Log audit entry
        INSERT INTO dbo.SECURITY_CHECK_AUDIT_LOG (
            security_check_id,
            action_type,
            action_remarks
        ) VALUES (
            @SecurityCheckId,
            'GATE_PASS_SENT',
            'Gate pass QR code sent to visitor email'
        );

        SELECT 'SUCCESS' AS status, 'Gate pass updated' AS message;

    END TRY
    BEGIN CATCH
        SELECT 'ERROR' AS status, ERROR_MESSAGE() AS message;
    END CATCH;
END
GO

PRINT '========== SECURITY CHECK DATABASE SETUP - COMPLETE ==========';
