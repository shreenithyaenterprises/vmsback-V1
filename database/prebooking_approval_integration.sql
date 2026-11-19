-- ============================================
-- PREBOOKING-APPROVAL INTEGRATION
-- Creates approval log entries when form is submitted
-- ============================================

USE PremiumVms;
GO

-- UPDATED: Prebooking_Form_Submit_SP with Approval Log Creation
CREATE OR ALTER PROCEDURE dbo.Prebooking_Form_Submit_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Token NVARCHAR(64) =
		@XMLData.value('(/Prebooking/Token)[1]', 'NVARCHAR(64)');
	DECLARE @VisitorName NVARCHAR(120) =
		@XMLData.value('(/Prebooking/VisitorName)[1]', 'NVARCHAR(120)');
	DECLARE @VisitorEmail NVARCHAR(160) =
		@XMLData.value('(/Prebooking/VisitorEmail)[1]', 'NVARCHAR(160)');
	DECLARE @VisitorMobile NVARCHAR(20) =
		@XMLData.value('(/Prebooking/VisitorMobile)[1]', 'NVARCHAR(20)');
	DECLARE @IdProofId INT =
		@XMLData.value('(/Prebooking/IdProofId)[1]', 'INT');
	DECLARE @IdProofNumber NVARCHAR(80) =
		@XMLData.value('(/Prebooking/IdProofNumber)[1]', 'NVARCHAR(80)');
	DECLARE @PurposeId INT =
		@XMLData.value('(/Prebooking/PurposeId)[1]', 'INT');
	DECLARE @VisitDate DATE =
		@XMLData.value('(/Prebooking/VisitDate)[1]', 'DATE');
	DECLARE @VisitTimeSlot NVARCHAR(40) =
		@XMLData.value('(/Prebooking/VisitTimeSlot)[1]', 'NVARCHAR(40)');
	DECLARE @CompanyName NVARCHAR(160) =
		@XMLData.value('(/Prebooking/CompanyName)[1]', 'NVARCHAR(160)');
	DECLARE @Address NVARCHAR(240) =
		@XMLData.value('(/Prebooking/Address)[1]', 'NVARCHAR(240)');
	DECLARE @Notes NVARCHAR(400) =
		@XMLData.value('(/Prebooking/Notes)[1]', 'NVARCHAR(400)');
	DECLARE @VisitorPhoto NVARCHAR(MAX);

	IF @Token IS NULL OR @VisitorName IS NULL OR @VisitorEmail IS NULL
		OR @VisitorMobile IS NULL OR @IdProofId IS NULL OR @IdProofNumber IS NULL
		OR @PurposeId IS NULL OR @VisitDate IS NULL OR @VisitTimeSlot IS NULL
		OR @XMLData.exist('/Prebooking/VisitorPhotoBase64[1]') = 0
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Required prebooking fields are missing' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	DECLARE @PrebookingId INT;
	DECLARE @HostEmployeeId INT;
	DECLARE @IsPublicToken BIT = CASE WHEN @Token LIKE 'PUBLIC_%' THEN 1 ELSE 0 END;

	IF @IsPublicToken = 1
	BEGIN
		-- Public submission: create a new prebooking_request record
		DECLARE @HostEmployeeIdFromXml INT = @XMLData.value('(/Prebooking/HostEmployeeId)[1]', 'INT');
		
		IF @HostEmployeeIdFromXml IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Host employee is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END

		INSERT INTO dbo.prebooking_request (
			token,
			visitor_name,
			visitor_email,
			host_employee_id,
			department_id,
			visit_date,
			status,
			expires_at
		)
		VALUES (
			@Token,
			@VisitorName,
			@VisitorEmail,
			@HostEmployeeIdFromXml,
			(SELECT TOP 1 department_id FROM dbo.employee_master WHERE employee_id = @HostEmployeeIdFromXml),
			@VisitDate,
			'SUBMITTED',
			DATEADD(DAY, 30, SYSUTCDATETIME())
		);

		SET @PrebookingId = SCOPE_IDENTITY();
		SET @HostEmployeeId = @HostEmployeeIdFromXml;
	END
	ELSE
	BEGIN
		-- Named token: lookup existing prebooking record
		SELECT @PrebookingId = prebooking_id, @HostEmployeeId = host_employee_id
		FROM dbo.prebooking_request
		WHERE token = @Token;

		IF @PrebookingId IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Prebooking request not found' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END

		IF EXISTS (
			SELECT 1 FROM dbo.prebooking_request
			WHERE prebooking_id = @PrebookingId AND expires_at < SYSUTCDATETIME()
		)
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Prebooking link expired' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END

		IF EXISTS (
			SELECT 1 FROM dbo.prebooking_submission
			WHERE prebooking_id = @PrebookingId
		)
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Prebooking already submitted' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END
	END

	IF NOT EXISTS (
		SELECT 1 FROM dbo.id_proof_master
		WHERE id_proof_id = @IdProofId AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Id proof not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (
		SELECT 1 FROM dbo.purpose_master
		WHERE purpose_id = @PurposeId AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Purpose not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	BEGIN TRANSACTION;
	BEGIN TRY
		SET @VisitorPhoto = CONVERT(
			NVARCHAR(MAX),
			@XMLData.query('data((/Prebooking/VisitorPhotoBase64)[1])')
		);

		-- 1. Insert prebooking submission
		INSERT INTO dbo.prebooking_submission (
			prebooking_id,
			visitor_name,
			visitor_email,
			visitor_mobile,
			id_proof_id,
			id_proof_number,
			purpose_id,
			visit_date,
			visit_time_slot,
			company_name,
			address,
			notes,
			visitor_photo
		)
		VALUES (
			@PrebookingId,
			@VisitorName,
			@VisitorEmail,
			@VisitorMobile,
			@IdProofId,
			@IdProofNumber,
			@PurposeId,
			@VisitDate,
			@VisitTimeSlot,
			@CompanyName,
			@Address,
			@Notes,
			@VisitorPhoto
		);

		-- 2. Get approval authorities for the host employee
		-- Create approval log entries for each approver
		INSERT INTO dbo.visit_approval_log (
			prebooking_id,
			approval_level,
			approver_id,
			action
		)
		SELECT 
			@PrebookingId,
			aam.approval_level,
			aam.approver_employee_id,
			'PENDING'
		FROM dbo.approval_authority_master aam
		WHERE aam.employee_id = @HostEmployeeId 
			AND aam.is_active = 1
		ORDER BY aam.approval_level ASC;

		-- 3. Update prebooking status
		UPDATE dbo.prebooking_request
		SET status = 'SUBMITTED'
		WHERE prebooking_id = @PrebookingId;

		COMMIT TRANSACTION;
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0
			ROLLBACK TRANSACTION;

		SELECT (
			SELECT 'E' AS Success, ERROR_MESSAGE() AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END CATCH

	SELECT (
		SELECT 
			'S' AS Success, 
			'Prebooking submitted and approval process initiated' AS Message, 
			@PrebookingId AS PrebookingId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

PRINT 'Prebooking-Approval Integration Updated!';
PRINT '';
PRINT '=== WORKFLOW ===';
PRINT '1. Visitor submits form with token';
PRINT '2. Submission record created';
PRINT '3. Approval logs created for all approvers of host employee';
PRINT '4. Approvers see it in their pending approvals queue';
PRINT '';
PRINT 'Setup Check:';
PRINT '1. Create some employees';
PRINT '2. Setup approval authorities (who approves for whom)';
PRINT '3. Send prebooking form to visitor';
PRINT '4. Visitor fills and submits form';
PRINT '5. Approvers should see it in /prebooking/approvals';
GO
