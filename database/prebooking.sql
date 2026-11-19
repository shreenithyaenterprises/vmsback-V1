IF OBJECT_ID('dbo.email_template', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.email_template (
		template_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		template_code NVARCHAR(60) NOT NULL UNIQUE,
		subject NVARCHAR(200) NOT NULL,
		body_html NVARCHAR(MAX) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_email_template_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_email_template_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.email_template WHERE template_code = 'PREBOOKING_REQUEST')
BEGIN
	INSERT INTO dbo.email_template (template_code, subject, body_html)
	VALUES (
		'PREBOOKING_REQUEST',
		'Complete your visit pre-booking',
		'<div style="font-family: Arial, sans-serif; background-color:#f7f7fb; padding:24px;">
		  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; padding:24px;">
		    <h2 style="margin:0 0 12px 0; color:#111827;">Pre-booking request</h2>
		    <p style="margin:0 0 12px 0; color:#374151;">Hi {{visitor_name}},</p>
		    <p style="margin:0 0 16px 0; color:#374151;">Please complete your visit pre-booking by clicking the button below.</p>
		    <a href="{{form_link}}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px;">Complete pre-booking</a>
		    <p style="margin:16px 0 0 0; color:#6b7280; font-size:12px;">This link expires in 48 hours.</p>
		  </div>
		</div>'
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.email_template WHERE template_code = 'visitormessage')
BEGIN
	INSERT INTO dbo.email_template (template_code, subject, body_html)
	VALUES (
		'visitormessage',
		'Visitor pre-booking request',
		'<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
		  <p>Dear Sir/Madam,</p>
		  <p>A visitor pre-booking request has been initiated by {{company_name}}.</p>
		  <p>Visitor Name: {{visitor_name}}</p>
		  <p>Kindly complete the required details using the link below:</p>
		  <p><a href="{{form_link}}">{{form_link}}</a></p>
		  <p>Regards,<br />{{signature_name}}</p>
		  <p>Thanks Visit Again</p>
		</div>'
	);
END
GO

IF OBJECT_ID('dbo.prebooking_request', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.prebooking_request (
		prebooking_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		visitor_name NVARCHAR(120) NOT NULL,
		visitor_email NVARCHAR(160) NOT NULL,
		host_employee_id INT NULL,
		department_id INT NULL,
		visit_date DATE NOT NULL,
		token NVARCHAR(64) NOT NULL UNIQUE,
		status NVARCHAR(20) NOT NULL CONSTRAINT DF_prebooking_request_status DEFAULT ('PENDING'),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_prebooking_request_created_at DEFAULT (SYSUTCDATETIME()),
		expires_at DATETIME2(0) NOT NULL
	);
END
GO

IF OBJECT_ID('dbo.prebooking_request', 'U') IS NOT NULL
	AND OBJECT_ID('dbo.employee_master', 'U') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = 'FK_prebooking_request_employee'
	)
BEGIN
	ALTER TABLE dbo.prebooking_request WITH NOCHECK
	ADD CONSTRAINT FK_prebooking_request_employee
		FOREIGN KEY (host_employee_id)
		REFERENCES dbo.employee_master (employee_id);
END
GO

IF OBJECT_ID('dbo.prebooking_request', 'U') IS NOT NULL
	AND OBJECT_ID('dbo.department_master', 'U') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = 'FK_prebooking_request_department'
	)
BEGIN
	ALTER TABLE dbo.prebooking_request WITH NOCHECK
	ADD CONSTRAINT FK_prebooking_request_department
		FOREIGN KEY (department_id)
		REFERENCES dbo.department_master (department_id);
END
GO

-- Drop old constraint if exists
IF EXISTS (
	SELECT 1
	FROM sys.check_constraints
	WHERE name = 'CK_prebooking_request_status'
)
BEGIN
	ALTER TABLE dbo.prebooking_request
	DROP CONSTRAINT CK_prebooking_request_status;
END
GO

-- Add updated constraint with APPROVED and REJECTED
IF OBJECT_ID('dbo.prebooking_request', 'U') IS NOT NULL
BEGIN
	ALTER TABLE dbo.prebooking_request
	ADD CONSTRAINT CK_prebooking_request_status
		CHECK (status IN ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'));
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Template_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @TemplateCode NVARCHAR(60) =
		@XMLData.value('(/Template/TemplateCode)[1]', 'NVARCHAR(60)');

	IF @TemplateCode IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'TemplateCode is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (
		SELECT 1 FROM dbo.email_template
		WHERE template_code = @TemplateCode AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Template not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Template fetched' AS Message,
			JSON_QUERY((
				SELECT
					template_id AS TemplateId,
					template_code AS TemplateCode,
					subject AS Subject,
					body_html AS BodyHtml,
					is_active AS IsActive
				FROM dbo.email_template
				WHERE template_code = @TemplateCode AND is_active = 1
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Template_List_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @OnlyActive BIT = @XMLData.value('(/Template/OnlyActive)[1]', 'BIT');

	SELECT (
		SELECT
			'S' AS Success,
			'Templates fetched' AS Message,
			JSON_QUERY((
				SELECT
					template_id AS TemplateId,
					template_code AS TemplateCode,
					subject AS Subject,
					body_html AS BodyHtml,
					is_active AS IsActive,
					created_at AS CreatedAt,
					updated_at AS UpdatedAt
				FROM dbo.email_template
				WHERE @OnlyActive IS NULL OR is_active = @OnlyActive
				ORDER BY template_id DESC
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Template_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @TemplateCode NVARCHAR(60) =
		@XMLData.value('(/Template/TemplateCode)[1]', 'NVARCHAR(60)');
	DECLARE @Subject NVARCHAR(200) =
		@XMLData.value('(/Template/Subject)[1]', 'NVARCHAR(200)');
	DECLARE @BodyHtml NVARCHAR(MAX) =
		@XMLData.value('(/Template/BodyHtml)[1]', 'NVARCHAR(MAX)');

	IF @TemplateCode IS NULL OR @Subject IS NULL OR @BodyHtml IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'TemplateCode, Subject, and BodyHtml are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.email_template WHERE template_code = @TemplateCode)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Template code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.email_template (template_code, subject, body_html)
	VALUES (@TemplateCode, @Subject, @BodyHtml);

	DECLARE @TemplateId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Template created' AS Message, @TemplateId AS TemplateId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Template_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @TemplateId INT =
		@XMLData.value('(/Template/TemplateId)[1]', 'INT');
	DECLARE @Subject NVARCHAR(200) =
		@XMLData.value('(/Template/Subject)[1]', 'NVARCHAR(200)');
	DECLARE @BodyHtml NVARCHAR(MAX) =
		@XMLData.value('(/Template/BodyHtml)[1]', 'NVARCHAR(MAX)');

	IF @TemplateId IS NULL OR @Subject IS NULL OR @BodyHtml IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'TemplateId, Subject, and BodyHtml are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.email_template WHERE template_id = @TemplateId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Template not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.email_template
	SET subject = @Subject,
		body_html = @BodyHtml,
		updated_at = SYSUTCDATETIME()
	WHERE template_id = @TemplateId;

	SELECT (
		SELECT 'S' AS Success, 'Template updated' AS Message, @TemplateId AS TemplateId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Template_Toggle_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @TemplateId INT =
		@XMLData.value('(/Template/TemplateId)[1]', 'INT');
	DECLARE @IsActive BIT =
		@XMLData.value('(/Template/IsActive)[1]', 'BIT');

	IF @TemplateId IS NULL OR @IsActive IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'TemplateId and IsActive are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.email_template WHERE template_id = @TemplateId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Template not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.email_template
	SET is_active = @IsActive,
		updated_at = SYSUTCDATETIME()
	WHERE template_id = @TemplateId;

	SELECT (
		SELECT 'S' AS Success, 'Template status updated' AS Message, @TemplateId AS TemplateId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Request_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @VisitorName NVARCHAR(120) =
		@XMLData.value('(/Prebooking/VisitorName)[1]', 'NVARCHAR(120)');
	DECLARE @VisitorEmail NVARCHAR(160) =
		@XMLData.value('(/Prebooking/VisitorEmail)[1]', 'NVARCHAR(160)');
	DECLARE @HostEmployeeId INT =
		@XMLData.value('(/Prebooking/HostEmployeeId)[1]', 'INT');
	DECLARE @DepartmentId INT =
		@XMLData.value('(/Prebooking/DepartmentId)[1]', 'INT');
	DECLARE @VisitDate DATE =
		@XMLData.value('(/Prebooking/VisitDate)[1]', 'DATE');

	IF @VisitorName IS NULL OR @VisitorEmail IS NULL OR @DepartmentId IS NULL OR @VisitDate IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'VisitorName, VisitorEmail, DepartmentId, and VisitDate are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (
		SELECT 1 FROM dbo.department_master
		WHERE department_id = @DepartmentId AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF @HostEmployeeId IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM dbo.employee_master
		WHERE employee_id = @HostEmployeeId AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Host employee not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	DECLARE @Token NVARCHAR(64);
	DECLARE @Attempts INT = 0;

	WHILE @Attempts < 5
	BEGIN
		SET @Token = REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', '');
		IF NOT EXISTS (SELECT 1 FROM dbo.prebooking_request WHERE token = @Token)
			BREAK;
		SET @Attempts += 1;
	END

	IF @Token IS NULL OR EXISTS (SELECT 1 FROM dbo.prebooking_request WHERE token = @Token)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Unable to generate token' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	DECLARE @ExpiresAt DATETIME2(0) = DATEADD(HOUR, 48, SYSUTCDATETIME());

	INSERT INTO dbo.prebooking_request (
		visitor_name,
		visitor_email,
		host_employee_id,
		department_id,
		visit_date,
		token,
		expires_at
	)
	VALUES (
		@VisitorName,
		@VisitorEmail,
		@HostEmployeeId,
		@DepartmentId,
		@VisitDate,
		@Token,
		@ExpiresAt
	);

	DECLARE @PrebookingId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT
			'S' AS Success,
			'Prebooking request created' AS Message,
			@PrebookingId AS PrebookingId,
			@Token AS Token,
			@ExpiresAt AS ExpiresAt
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Request_GetByToken_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Token NVARCHAR(64) =
		@XMLData.value('(/Prebooking/Token)[1]', 'NVARCHAR(64)');

	IF @Token IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Token is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.prebooking_request WHERE token = @Token)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Prebooking request not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.prebooking_request
		WHERE token = @Token AND expires_at < SYSUTCDATETIME()
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Prebooking link expired' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Prebooking request fetched' AS Message,
			JSON_QUERY((
				SELECT
					prebooking_id AS PrebookingId,
					visitor_name AS VisitorName,
					visitor_email AS VisitorEmail,
					host_employee_id AS HostEmployeeId,
					department_id AS DepartmentId,
					visit_date AS VisitDate,
					token AS Token,
					status AS Status,
					created_at AS CreatedAt,
					expires_at AS ExpiresAt
				FROM dbo.prebooking_request
				WHERE token = @Token
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Request_List_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Status NVARCHAR(20) =
		@XMLData.value('(/Prebooking/Status)[1]', 'NVARCHAR(20)');
	DECLARE @FromDate DATE =
		@XMLData.value('(/Prebooking/FromDate)[1]', 'DATE');
	DECLARE @ToDate DATE =
		@XMLData.value('(/Prebooking/ToDate)[1]', 'DATE');

	SELECT (
		SELECT
			'S' AS Success,
			'Prebooking requests fetched' AS Message,
			JSON_QUERY((
				SELECT
					prebooking_id AS PrebookingId,
					visitor_name AS VisitorName,
					visitor_email AS VisitorEmail,
					host_employee_id AS HostEmployeeId,
					department_id AS DepartmentId,
					visit_date AS VisitDate,
					token AS Token,
					status AS Status,
					created_at AS CreatedAt,
					expires_at AS ExpiresAt
				FROM dbo.prebooking_request
				WHERE (@Status IS NULL OR status = @Status)
					AND (@FromDate IS NULL OR visit_date >= @FromDate)
					AND (@ToDate IS NULL OR visit_date <= @ToDate)
				ORDER BY prebooking_id DESC
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.prebooking_submission', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.prebooking_submission (
		submission_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		prebooking_id INT NOT NULL UNIQUE,
		visitor_name NVARCHAR(120) NOT NULL,
		visitor_email NVARCHAR(160) NOT NULL,
		visitor_mobile NVARCHAR(20) NOT NULL,
		id_proof_id INT NOT NULL,
		id_proof_number NVARCHAR(80) NOT NULL,
		purpose_id INT NOT NULL,
		visit_date DATE NOT NULL,
		visit_time_slot NVARCHAR(40) NOT NULL,
		company_name NVARCHAR(160) NULL,
		address NVARCHAR(240) NULL,
		notes NVARCHAR(400) NULL,
		created_at DATETIME2(0) NOT NULL
			CONSTRAINT DF_prebooking_submission_created_at DEFAULT (SYSUTCDATETIME())
	);
END
GO

IF OBJECT_ID('dbo.prebooking_submission', 'U') IS NOT NULL
	AND OBJECT_ID('dbo.prebooking_request', 'U') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = 'FK_prebooking_submission_request'
	)
BEGIN
	ALTER TABLE dbo.prebooking_submission WITH NOCHECK
	ADD CONSTRAINT FK_prebooking_submission_request
		FOREIGN KEY (prebooking_id)
		REFERENCES dbo.prebooking_request (prebooking_id);
END
GO

IF OBJECT_ID('dbo.prebooking_submission', 'U') IS NOT NULL
	AND OBJECT_ID('dbo.id_proof_master', 'U') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = 'FK_prebooking_submission_id_proof'
	)
BEGIN
	ALTER TABLE dbo.prebooking_submission WITH NOCHECK
	ADD CONSTRAINT FK_prebooking_submission_id_proof
		FOREIGN KEY (id_proof_id)
		REFERENCES dbo.id_proof_master (id_proof_id);
END
GO

IF OBJECT_ID('dbo.prebooking_submission', 'U') IS NOT NULL
	AND OBJECT_ID('dbo.purpose_master', 'U') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = 'FK_prebooking_submission_purpose'
	)
BEGIN
	ALTER TABLE dbo.prebooking_submission WITH NOCHECK
	ADD CONSTRAINT FK_prebooking_submission_purpose
		FOREIGN KEY (purpose_id)
		REFERENCES dbo.purpose_master (purpose_id);
END
GO

IF OBJECT_ID('dbo.prebooking_submission', 'U') IS NOT NULL
	AND COL_LENGTH('dbo.prebooking_submission', 'visitor_photo') IS NULL
BEGIN
	ALTER TABLE dbo.prebooking_submission
	ADD visitor_photo NVARCHAR(MAX) NULL;
END
GO

IF OBJECT_ID('dbo.prebooking_submission', 'U') IS NOT NULL
	AND COL_LENGTH('dbo.prebooking_submission', 'visitor_photo') IS NOT NULL
BEGIN
	ALTER TABLE dbo.prebooking_submission
	ALTER COLUMN visitor_photo NVARCHAR(MAX) NULL;
END
GO

CREATE OR ALTER PROCEDURE dbo.Prebooking_Form_GetByToken_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Token NVARCHAR(64) =
		@XMLData.value('(/Prebooking/Token)[1]', 'NVARCHAR(64)');

	IF @Token IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Token is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.prebooking_request WHERE token = @Token)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Prebooking request not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.prebooking_request
		WHERE token = @Token AND expires_at < SYSUTCDATETIME()
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Prebooking link expired' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Prebooking form data fetched' AS Message,
			JSON_QUERY((
				SELECT
					prebooking_id AS PrebookingId,
					visitor_name AS VisitorName,
					visitor_email AS VisitorEmail,
					host_employee_id AS HostEmployeeId,
					department_id AS DepartmentId,
					visit_date AS VisitDate,
					token AS Token,
					status AS Status,
					expires_at AS ExpiresAt
				FROM dbo.prebooking_request
				WHERE token = @Token
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

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
	DECLARE @PurposeName NVARCHAR(160);
	DECLARE @IsVIP BIT = 0;
	DECLARE @ResponseMessage NVARCHAR(200) = 'Prebooking submitted and approval process initiated';

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

	SELECT @PurposeName = name
	FROM dbo.purpose_master
	WHERE purpose_id = @PurposeId;

	IF UPPER(ISNULL(@PurposeName, '')) LIKE '%VIP%'
	BEGIN
		SET @IsVIP = 1;
		SET @ResponseMessage = 'VIP prebooking submitted and auto-approved';
	END

	BEGIN TRANSACTION;
	BEGIN TRY
		SET @VisitorPhoto = CONVERT(
			NVARCHAR(MAX),
			@XMLData.query('data((/Prebooking/VisitorPhotoBase64)[1])')
		);

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

		IF @IsVIP = 1
		BEGIN
			UPDATE dbo.prebooking_request
			SET status = 'APPROVED'
			WHERE prebooking_id = @PrebookingId;
		END
		ELSE
		BEGIN
			-- Create approval log entries for each approver level
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

			UPDATE dbo.prebooking_request
			SET status = 'SUBMITTED'
			WHERE prebooking_id = @PrebookingId;
		END

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
		SELECT 'S' AS Success, @ResponseMessage AS Message, @PrebookingId AS PrebookingId, @IsVIP AS AutoApproved
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO
