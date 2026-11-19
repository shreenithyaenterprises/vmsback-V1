-- ============================================================
-- VISIT TRANSACTION DATABASE SCHEMA
-- Complete entry/exit management with QR + PPE tracking
-- ============================================================

USE [main]
GO

-- ============================================================
-- 1. Drop dependent tables first (VISIT_AUDIT_LOG has FK to VISIT_TRANSACTION)
-- ============================================================
IF OBJECT_ID('dbo.VISIT_AUDIT_LOG', 'U') IS NOT NULL
	DROP TABLE dbo.VISIT_AUDIT_LOG;

IF OBJECT_ID('dbo.VISIT_TRANSACTION', 'U') IS NOT NULL
	DROP TABLE dbo.VISIT_TRANSACTION;

IF OBJECT_ID('dbo.EMAIL_TEMPLATE_MASTER', 'U') IS NOT NULL
	DROP TABLE dbo.EMAIL_TEMPLATE_MASTER;

-- ============================================================
-- 2. VISIT_TRANSACTION TABLE
-- ============================================================
CREATE TABLE dbo.VISIT_TRANSACTION (
	VisitID INT PRIMARY KEY IDENTITY(1,1),
	PreBookingID INT NOT NULL,
	VisitorName NVARCHAR(100) NOT NULL,
	VisitorEmail NVARCHAR(100) NOT NULL,
	VisitorMobile NVARCHAR(20) NOT NULL,
	VisitorPhotoBase64 NVARCHAR(MAX),
	VisitType NVARCHAR(20),  -- OFFICIAL, VENDOR, PERSONAL, CONTRACTOR
	Purpose NVARCHAR(200),
	HostEmployeeID INT NOT NULL,
	HostEmployeeName NVARCHAR(100),
	HostEmployeeMobile NVARCHAR(20),
	DepartmentID INT,
	DepartmentName NVARCHAR(100),
	ApprovalStatus NVARCHAR(20),  -- APPROVED, REJECTED, PENDING
	ApprovedBy INT,
	ApprovedAt DATETIME,
	
	-- Gate Pass Info
	ReferenceCode NVARCHAR(50) UNIQUE,  -- VMS-2024-001234
	QRCodeData NVARCHAR(MAX),  -- Base64 QR image
	GatePassGeneratedAt DATETIME,
	GatePassEmailSentAt DATETIME,
	GatePassValidTill DATETIME,  -- Only valid on visit date
	
	-- Entry/Exit
	VisitStatus NVARCHAR(20) DEFAULT 'PENDING_ENTRY',  -- PENDING_ENTRY, CHECKED_IN, CHECKED_OUT, COMPLETED
	EntryTime DATETIME,
	ExitTime DATETIME,
	EntryGate NVARCHAR(50),
	ExitGate NVARCHAR(50),
	
	-- PPE Compliance (Optional)
	PPERequired BIT DEFAULT 0,  -- 0 = not required, 1 = required
	PPEItems NVARCHAR(MAX),  -- Comma-separated list of items given
	ReturnedPPEItems NVARCHAR(MAX),  -- Comma-separated list of items returned at check-out
	PPEVerifiedBy INT,
	PPEVerifiedAt DATETIME,
	
	-- Audit
	CreatedAt DATETIME DEFAULT GETDATE(),
	CreatedBy INT,
	UpdatedAt DATETIME,
	UpdatedBy INT,
	Notes NVARCHAR(MAX),
	
	-- Indexes
	INDEX IX_PreBooking (PreBookingID),
	INDEX IX_HostEmployee (HostEmployeeID),
	INDEX IX_ReferenceCode (ReferenceCode),
	INDEX IX_VisitStatus (VisitStatus),
	INDEX IX_EntryTime (EntryTime)
);

GO

-- ============================================================
-- 3. EMAIL_TEMPLATE_MASTER TABLE
-- ============================================================
CREATE TABLE dbo.EMAIL_TEMPLATE_MASTER (
	TemplateID INT PRIMARY KEY IDENTITY(1,1),
	TemplateCode NVARCHAR(50) UNIQUE NOT NULL,  -- GATE_PASS, APPROVAL_GRANTED, APPROVAL_REJECTED, etc.
	TemplateName NVARCHAR(150),
	Subject NVARCHAR(255),
	BodyHTML NVARCHAR(MAX),  -- HTML template with placeholders like {{VISITOR_NAME}}, {{QR_CODE}}, etc.
	IsActive BIT DEFAULT 1,
	CreatedAt DATETIME DEFAULT GETDATE(),
	UpdatedAt DATETIME
);

GO

-- ============================================================
-- 4. VISIT_AUDIT_LOG TABLE
-- ============================================================
CREATE TABLE dbo.VISIT_AUDIT_LOG (
	LogID INT PRIMARY KEY IDENTITY(1,1),
	VisitID INT NOT NULL,
	Action NVARCHAR(100),  -- CREATED, QR_GENERATED, EMAIL_SENT, CHECK_IN, CHECK_OUT, PPE_VERIFIED, COMPLETED
	Details NVARCHAR(MAX),
	ActionBy INT,
	ActionAt DATETIME DEFAULT GETDATE(),
	
	FOREIGN KEY (VisitID) REFERENCES VISIT_TRANSACTION(VisitID),
	INDEX IX_VisitID (VisitID)
);

GO

-- ============================================================
-- 5. Stored Procedure: CreateVisitTransaction_SP
-- ============================================================
IF OBJECT_ID('dbo.CreateVisitTransaction_SP', 'P') IS NOT NULL
	DROP PROCEDURE dbo.CreateVisitTransaction_SP;

GO

CREATE PROCEDURE dbo.CreateVisitTransaction_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;
	
	BEGIN TRY
		DECLARE @preBookingID INT;
		DECLARE @referenceCode NVARCHAR(50);
		DECLARE @visitID INT;
		
		-- Parse XML if provided
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			DECLARE @xml XML = CAST(@XMLData AS XML);
			SET @preBookingID = @xml.value('(/VisitRequest/PreBookingID)[1]', 'INT');
		END;
		
		IF @preBookingID IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'PreBookingID is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;
		
		-- Get prebooking details
		DECLARE @visitorName NVARCHAR(100);
		DECLARE @visitorEmail NVARCHAR(100);
		DECLARE @visitorMobile NVARCHAR(20);
		DECLARE @visitorPhoto NVARCHAR(MAX);
		DECLARE @purpose NVARCHAR(200);
		DECLARE @visitType NVARCHAR(20);
		DECLARE @hostEmployeeID INT;
		DECLARE @departmentID INT;
		DECLARE @visitDate DATETIME;
		DECLARE @visitTimeSlot NVARCHAR(50);
		DECLARE @approvalStatus NVARCHAR(20);
		
		SELECT TOP 1
			@visitorName = ISNULL(ps.visitor_name, pr.visitor_name),
			@visitorEmail = ISNULL(ps.visitor_email, pr.visitor_email),
			@visitorMobile = ISNULL(ps.visitor_mobile, ''),
			@visitorPhoto = ISNULL(ps.visitor_photo, ''),
			@purpose = ISNULL(pm.name, ''),
			@hostEmployeeID = pr.host_employee_id,
			@departmentID = pr.department_id,
			@visitDate = ISNULL(ps.visit_date, pr.visit_date),
			@visitTimeSlot = ISNULL(ps.visit_time_slot, ''),
			@approvalStatus = pr.status
		FROM dbo.PreBooking_Request pr
		LEFT JOIN dbo.prebooking_submission ps ON ps.prebooking_id = pr.prebooking_id
		LEFT JOIN dbo.purpose_master pm ON pm.purpose_id = ps.purpose_id
		WHERE pr.prebooking_id = @preBookingID;
		
		IF @visitorName IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'PreBooking not found' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		IF ISNULL(@approvalStatus, '') = 'REJECTED'
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'PreBooking request is rejected. Gate pass cannot be generated.' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		IF ISNULL(@approvalStatus, '') <> 'APPROVED'
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'PreBooking request is not approved yet. Gate pass cannot be generated.' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		SET @visitType = CASE
			WHEN UPPER(ISNULL(@purpose, '')) LIKE '%VIP%' THEN 'VIP'
			ELSE 'OFFICIAL'
		END;
		
		-- Generate reference code (VMS-YYYY-XXXXX)
		DECLARE @year INT = YEAR(GETDATE());
		DECLARE @sequence INT = (SELECT COUNT(*) + 1 FROM VISIT_TRANSACTION WHERE YEAR(CreatedAt) = @year);
		SET @referenceCode = 'VMS-' + CAST(@year AS NVARCHAR) + '-' + RIGHT('00000' + CAST(@sequence AS NVARCHAR), 5);
		
		-- Get host employee details
		DECLARE @hostName NVARCHAR(100);
		DECLARE @hostMobile NVARCHAR(20);
		DECLARE @deptName NVARCHAR(100);
		
		SELECT TOP 1
			@hostName = e.name,
			@hostMobile = e.mobile,
			@deptName = d.name
		FROM dbo.employee_master e
		LEFT JOIN dbo.department_master d ON e.department_id = d.department_id
		WHERE e.employee_id = @hostEmployeeID;
		
		-- Insert visit transaction
		INSERT INTO VISIT_TRANSACTION (
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
			ReferenceCode,
			GatePassValidTill,
			VisitStatus,
			CreatedAt
		)
		VALUES (
			@preBookingID,
			@visitorName,
			@visitorEmail,
			@visitorMobile,
			@visitorPhoto,
			@visitType,
			@purpose,
			@hostEmployeeID,
			@hostName,
			@hostMobile,
			@departmentID,
			@deptName,
			@approvalStatus,
			@referenceCode,
			CONVERT(DATE, @visitDate),  -- Valid till end of visit date
			'PENDING_ENTRY',
			GETDATE()
		);
		
		SET @visitID = SCOPE_IDENTITY();
		
		-- Log action
		INSERT INTO VISIT_AUDIT_LOG (VisitID, Action, Details)
		VALUES (@visitID, 'CREATED', 'Visit transaction created from PreBooking');
		
		SELECT (
			SELECT 'S' AS Success, 'Visit transaction created successfully' AS Message,
				@visitID AS VisitID,
				@referenceCode AS ReferenceCode,
				@preBookingID AS PreBookingID
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

-- ============================================================
-- 6. Stored Procedure: GenerateQRCode_SP
-- ============================================================
IF OBJECT_ID('dbo.GenerateQRCode_SP', 'P') IS NOT NULL
	DROP PROCEDURE dbo.GenerateQRCode_SP;

GO

CREATE PROCEDURE dbo.GenerateQRCode_SP
	@VisitID INT,
	@QRCodeData NVARCHAR(MAX) OUTPUT
AS
BEGIN
	SET NOCOUNT ON;
	
	BEGIN TRY
		DECLARE @referenceCode NVARCHAR(50);
		
		SELECT @referenceCode = ReferenceCode
		FROM VISIT_TRANSACTION
		WHERE VisitID = @VisitID;
		
		IF @referenceCode IS NULL
		BEGIN
			RAISERROR('Visit not found', 16, 1);
			RETURN 1;
		END;
		
		-- In real implementation, generate QR code via API call from backend
		-- For now, store reference code as QR data
		SET @QRCodeData = @referenceCode;
		
		-- Update visit with QR code
		UPDATE VISIT_TRANSACTION
		SET QRCodeData = @QRCodeData,
			GatePassGeneratedAt = GETDATE()
		WHERE VisitID = @VisitID;
		
		INSERT INTO VISIT_AUDIT_LOG (VisitID, Action, Details)
		VALUES (@VisitID, 'QR_GENERATED', 'QR Code generated: ' + @referenceCode);
		
		RETURN 0;
	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
		RAISERROR (@ErrorMessage, 16, 1);
		RETURN 1;
	END CATCH;
END;

GO

-- ============================================================
-- 7. Stored Procedure: GetVisitByReferenceCode_SP
-- ============================================================
IF OBJECT_ID('dbo.GetVisitByReferenceCode_SP', 'P') IS NOT NULL
	DROP PROCEDURE dbo.GetVisitByReferenceCode_SP;

GO

CREATE PROCEDURE dbo.GetVisitByReferenceCode_SP
	@XMLData NVARCHAR(MAX)
AS
BEGIN
	SET NOCOUNT ON;
	
	BEGIN TRY
		DECLARE @referenceCode NVARCHAR(50) = NULL;
		
		-- Parse XML if provided
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			DECLARE @xml XML = CAST(@XMLData AS XML);
			SET @referenceCode = @xml.value('(/VisitRequest/ReferenceCode)[1]', 'NVARCHAR(50)');
		END;
		
		IF @referenceCode IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'ReferenceCode is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;
		
		DECLARE @visitDate DATE;
		
		SELECT TOP 1
			@visitDate = CONVERT(DATE, GatePassValidTill)
		FROM VISIT_TRANSACTION
		WHERE ReferenceCode = @referenceCode;
		
		-- Check if gate pass is still valid (only on visit date)
		IF @visitDate IS NOT NULL AND CONVERT(DATE, GETDATE()) > @visitDate
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Gate pass has expired' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;
		
		-- Return visit details
		SELECT (
			SELECT 'S' AS Success, 'Visit found' AS Message,
				VisitID,
				PreBookingID,
				VisitorName,
				VisitorEmail,
				VisitorMobile,
				VisitorPhotoBase64,
				Purpose,
				HostEmployeeID,
				HostEmployeeName,
				HostEmployeeMobile,
				DepartmentName,
				ReferenceCode,
				ApprovalStatus,
				VisitStatus,
				PPERequired,
				PPEItems,
				ReturnedPPEItems,
				GatePassValidTill
			FROM VISIT_TRANSACTION
			WHERE ReferenceCode = @referenceCode
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

-- ============================================================
-- 8. Stored Procedure: CheckInVisitor_SP
-- ============================================================
IF OBJECT_ID('dbo.CheckInVisitor_SP', 'P') IS NOT NULL
	DROP PROCEDURE dbo.CheckInVisitor_SP;

GO

CREATE PROCEDURE dbo.CheckInVisitor_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;
	
	BEGIN TRY
		DECLARE @visitID INT;
		DECLARE @ppeItems NVARCHAR(MAX);
		DECLARE @entryGate NVARCHAR(50);
		DECLARE @verifiedByEmployeeID INT;
		
		-- Parse XML if provided
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			DECLARE @xml XML = CAST(@XMLData AS XML);
			SET @visitID = @xml.value('(/CheckInRequest/VisitID)[1]', 'INT');
			SET @ppeItems = @xml.value('(/CheckInRequest/PPEItems)[1]', 'NVARCHAR(MAX)');
			SET @entryGate = @xml.value('(/CheckInRequest/EntryGate)[1]', 'NVARCHAR(50)');
			SET @verifiedByEmployeeID = @xml.value('(/CheckInRequest/VerifiedByEmployeeID)[1]', 'INT');
		END;
		
		IF @visitID IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'VisitID is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;
		
		DECLARE @currentStatus NVARCHAR(20);
		DECLARE @approvalStatus NVARCHAR(20);
		
		SELECT
			@currentStatus = VisitStatus,
			@approvalStatus = ApprovalStatus
		FROM VISIT_TRANSACTION
		WHERE VisitID = @visitID;
		
		IF @currentStatus IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Visit not found' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		IF ISNULL(@approvalStatus, '') <> 'APPROVED'
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Visitor request is not approved. Entry is not allowed.' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		SET @ppeItems = NULLIF(LTRIM(RTRIM(@ppeItems)), '');
		IF LOWER(ISNULL(@ppeItems, '')) = 'none'
			SET @ppeItems = NULL;
		
		-- Update visit with check-in details
		-- Allow re-entry for CHECKED_OUT visitors (e.g., returning after lunch)
		UPDATE VISIT_TRANSACTION
		SET VisitStatus = 'CHECKED_IN',
			EntryTime = GETDATE(),
			PPEItems = @ppeItems,
			PPEVerifiedBy = @verifiedByEmployeeID,
			PPEVerifiedAt = GETDATE(),
			EntryGate = @entryGate,
			ExitTime = NULL,
			ExitGate = NULL,
			ReturnedPPEItems = NULL,
			UpdatedAt = GETDATE()
		WHERE VisitID = @visitID;
		
		-- Log action
		INSERT INTO VISIT_AUDIT_LOG (VisitID, Action, Details, ActionBy)
		VALUES (@visitID, 'CHECK_IN', 'Visitor checked in. PPE: ' + ISNULL(@ppeItems, 'None'), @verifiedByEmployeeID);
		
		-- Return updated visit details
		SELECT (
			SELECT 'S' AS Success, 'Visitor checked in successfully' AS Message,
				VisitID,
				VisitorName,
				HostEmployeeName,
				Purpose,
				EntryTime,
				VisitStatus
			FROM VISIT_TRANSACTION
			WHERE VisitID = @visitID
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

-- ============================================================
-- 9. Stored Procedure: CheckOutVisitor_SP
-- ============================================================
IF OBJECT_ID('dbo.CheckOutVisitor_SP', 'P') IS NOT NULL
	DROP PROCEDURE dbo.CheckOutVisitor_SP;

GO

CREATE PROCEDURE dbo.CheckOutVisitor_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;
	
	BEGIN TRY
		DECLARE @visitID INT;
		DECLARE @exitGate NVARCHAR(50);
		DECLARE @returnedPPEItems NVARCHAR(MAX);
		
		-- Parse XML if provided
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			DECLARE @xml XML = CAST(@XMLData AS XML);
			SET @visitID = @xml.value('(/CheckOutRequest/VisitID)[1]', 'INT');
			SET @exitGate = @xml.value('(/CheckOutRequest/ExitGate)[1]', 'NVARCHAR(50)');
			SET @returnedPPEItems = @xml.value('(/CheckOutRequest/PPEItems)[1]', 'NVARCHAR(MAX)');
		END;
		
		IF @visitID IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'VisitID is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;
		
		DECLARE @currentStatus NVARCHAR(20);
		
		SELECT @currentStatus = VisitStatus
		FROM VISIT_TRANSACTION
		WHERE VisitID = @visitID;
		
		IF @currentStatus IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Visit not found' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;
		
		IF @currentStatus NOT IN ('CHECKED_IN')
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Visitor is not checked in' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		SET @returnedPPEItems = NULLIF(LTRIM(RTRIM(@returnedPPEItems)), '');
		IF LOWER(ISNULL(@returnedPPEItems, '')) = 'none'
			SET @returnedPPEItems = NULL;
		
		-- Update visit with check-out details
		UPDATE VISIT_TRANSACTION
		SET VisitStatus = 'CHECKED_OUT',
			ExitTime = GETDATE(),
			ExitGate = @exitGate,
			ReturnedPPEItems = @returnedPPEItems,
			UpdatedAt = GETDATE()
		WHERE VisitID = @visitID;
		
		-- Log action
		INSERT INTO VISIT_AUDIT_LOG (VisitID, Action, Details)
		VALUES (
			@visitID,
			'CHECK_OUT',
			'Visitor checked out from gate: ' + ISNULL(@exitGate, 'Main')
				+ '. Returned PPE: ' + ISNULL(NULLIF(@returnedPPEItems, ''), 'None')
		);
		
		-- Return updated visit details
		SELECT (
			SELECT 'S' AS Success, 'Visitor checked out successfully' AS Message,
				VisitID,
				VisitorName,
				HostEmployeeName,
				EntryTime,
				ExitTime,
				DATEDIFF(MINUTE, EntryTime, ExitTime) AS DurationMinutes,
				VisitStatus,
				PPEItems,
				ReturnedPPEItems
			FROM VISIT_TRANSACTION
			WHERE VisitID = @visitID
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

-- ============================================================
-- 10. Stored Procedure: GetPendingCheckIns_SP
-- ============================================================
IF OBJECT_ID('dbo.GetPendingCheckIns_SP', 'P') IS NOT NULL
	DROP PROCEDURE dbo.GetPendingCheckIns_SP;

GO

CREATE PROCEDURE dbo.GetPendingCheckIns_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;
	
	BEGIN TRY
		DECLARE @filterDate DATE = NULL;
		
		-- Parse XML if provided
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			DECLARE @xml XML = CAST(@XMLData AS XML);
			SET @filterDate = @xml.value('(/FilterRequest/FilterDate)[1]', 'DATE');
		END;
		
		IF @filterDate IS NULL
			SET @filterDate = CONVERT(DATE, GETDATE());
		
		SELECT (
			SELECT 'S' AS Success, 'Pending check-ins fetched' AS Message,
				JSON_QUERY((
					SELECT
						VisitID,
						PreBookingID,
						ReferenceCode,
						VisitorName,
						VisitorEmail,
						VisitorMobile,
						VisitorPhotoBase64,
						Purpose,
						HostEmployeeName,
						HostEmployeeMobile,
						DepartmentName,
						ApprovalStatus,
						VisitStatus,
						PPERequired,
						GatePassValidTill,
						CreatedAt
					FROM VISIT_TRANSACTION
					WHERE CONVERT(DATE, GatePassValidTill) = @filterDate
						AND VisitStatus = 'PENDING_ENTRY'
						AND ApprovalStatus = 'APPROVED'
					ORDER BY CreatedAt DESC
					FOR JSON PATH
				)) AS PendingVisits
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

-- ============================================================
-- Insert default email templates
-- ============================================================
DELETE FROM EMAIL_TEMPLATE_MASTER;

INSERT INTO EMAIL_TEMPLATE_MASTER (TemplateCode, TemplateName, Subject, BodyHTML)
VALUES 
(
	'GATE_PASS',
	'Gate Pass Letter',
	'Your Visitor Entry Gate Pass - {{COMPANY_NAME}}',
	'<html>
	<body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
		<div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px;">
			<div style="text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px;">
				<h2 style="color: #2c3e50; margin: 0;">VISITOR ENTRY PASS</h2>
				<p style="color: #7f8c8d; margin: 5px 0;">Reference: {{REFERENCE_CODE}}</p>
			</div>
			
			<div style="margin-top: 20px;">
				<h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 10px;">Visitor Information</h3>
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 10px; font-weight: bold; width: 30%;">Name:</td>
						<td style="padding: 10px;">{{VISITOR_NAME}}</td>
					</tr>
					<tr>
						<td style="padding: 10px; font-weight: bold;">Email:</td>
						<td style="padding: 10px;">{{VISITOR_EMAIL}}</td>
					</tr>
					<tr>
						<td style="padding: 10px; font-weight: bold;">Mobile:</td>
						<td style="padding: 10px;">{{VISITOR_MOBILE}}</td>
					</tr>
					<tr>
						<td style="padding: 10px; font-weight: bold;">Purpose:</td>
						<td style="padding: 10px;">{{PURPOSE}}</td>
					</tr>
				</table>
			</div>
			
			<div style="margin-top: 20px;">
				<h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 10px;">Visit Details</h3>
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 10px; font-weight: bold; width: 30%;">Host Name:</td>
						<td style="padding: 10px;">{{HOST_EMPLOYEE_NAME}}</td>
					</tr>
					<tr>
						<td style="padding: 10px; font-weight: bold;">Department:</td>
						<td style="padding: 10px;">{{DEPARTMENT_NAME}}</td>
					</tr>
					<tr>
						<td style="padding: 10px; font-weight: bold;">Visit Date:</td>
						<td style="padding: 10px;">{{VISIT_DATE}}</td>
					</tr>
					<tr>
						<td style="padding: 10px; font-weight: bold;">Time Slot:</td>
						<td style="padding: 10px;">{{TIME_SLOT}}</td>
					</tr>
				</table>
			</div>
			
			<div style="margin-top: 30px; text-align: center; background-color: #f0f0f0; padding: 20px; border-radius: 8px;">
				<p style="color: #7f8c8d; margin-top: 0;">Please present this QR code at the gate</p>
				<div style="margin: 20px 0;">
					{{QR_CODE_IMAGE}}
				</div>
				<p style="font-size: 14px; color: #34495e; margin: 10px 0;">
					<strong>Or mention this code:</strong><br>
					<span style="font-size: 18px; letter-spacing: 2px; font-weight: bold;">{{REFERENCE_CODE}}</span>
				</p>
			</div>
			
			<div style="margin-top: 20px; background-color: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; border-radius: 4px;">
				<p style="margin: 0; color: #856404;">
					<strong>⚠️ Important:</strong><br>
					• This pass is valid only on {{VISIT_DATE}}<br>
					• Please allow 10 minutes before scheduled time for gate verification<br>
					• Carry a valid ID proof<br>
					• Comply with all facility safety norms
				</p>
			</div>
			
			<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #bdc3c7; text-align: center; color: #7f8c8d; font-size: 12px;">
				<p>{{COMPANY_NAME}} - Visitor Management System</p>
				<p>This is an automated message. Please do not reply to this email.</p>
			</div>
		</div>
	</body>
	</html>'
);

GO

PRINT 'Visit Transaction schema created successfully!';
