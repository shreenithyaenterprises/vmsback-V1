IF DB_ID('PremiumVms') IS NULL
BEGIN
	CREATE DATABASE PremiumVms;
END
GO

USE PremiumVms;
GO

IF OBJECT_ID('dbo.user_profile', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.user_profile (
		user_id NVARCHAR(50) NOT NULL PRIMARY KEY,
		password_hash VARBINARY(32) NOT NULL,
		role NVARCHAR(50) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_user_profile_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_user_profile_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL,
		password_changed_at DATETIME2(0) NULL
	);
END
GO

CREATE OR ALTER PROCEDURE dbo.UserProfile_Login_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @UserId NVARCHAR(50) = @XMLData.value('(/Login/UserId)[1]', 'NVARCHAR(50)');
	DECLARE @Password NVARCHAR(200) = @XMLData.value('(/Login/Password)[1]', 'NVARCHAR(200)');

	IF @UserId IS NULL OR @Password IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'UserId and Password are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	DECLARE @Hash VARBINARY(32) = HASHBYTES('SHA2_256', CONCAT(@UserId, '|', @Password));
	DECLARE @Role NVARCHAR(50);

	SELECT @Role = role
	FROM dbo.user_profile
	WHERE user_id = @UserId
		AND password_hash = @Hash
		AND is_active = 1;

	IF @Role IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Invalid credentials' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT 'S' AS Success, 'Login successful' AS Message, @UserId AS UserId, @Role AS Role
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.UserProfile_ChangePassword_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @UserId NVARCHAR(50) = @XMLData.value('(/ChangePassword/UserId)[1]', 'NVARCHAR(50)');
	DECLARE @OldPassword NVARCHAR(200) = @XMLData.value('(/ChangePassword/OldPassword)[1]', 'NVARCHAR(200)');
	DECLARE @NewPassword NVARCHAR(200) = @XMLData.value('(/ChangePassword/NewPassword)[1]', 'NVARCHAR(200)');

	IF @UserId IS NULL OR @OldPassword IS NULL OR @NewPassword IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'UserId, OldPassword, and NewPassword are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	DECLARE @OldHash VARBINARY(32) = HASHBYTES('SHA2_256', CONCAT(@UserId, '|', @OldPassword));
	DECLARE @NewHash VARBINARY(32) = HASHBYTES('SHA2_256', CONCAT(@UserId, '|', @NewPassword));

	IF NOT EXISTS (
		SELECT 1 FROM dbo.user_profile
		WHERE user_id = @UserId AND password_hash = @OldHash AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Old password is incorrect' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.user_profile
	SET password_hash = @NewHash,
		updated_at = SYSUTCDATETIME(),
		password_changed_at = SYSUTCDATETIME()
	WHERE user_id = @UserId;

	SELECT (
		SELECT 'S' AS Success, 'Password changed successfully' AS Message, @UserId AS UserId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

-- Sample user insert (change password before production use)
INSERT INTO dbo.user_profile (user_id, password_hash, role)
VALUES ('admin', HASHBYTES('SHA2_256', CONCAT(N'admin', N'|', N'Admin@123')), 'ADMIN');
GO

IF OBJECT_ID('dbo.visitor_type_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.visitor_type_master (
		visitor_type_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		code NVARCHAR(30) NOT NULL UNIQUE,
		name NVARCHAR(100) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_visitor_type_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_visitor_type_master_created_at DEFAULT (SYSUTCDATETIME())
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.visitor_type_master)
BEGIN
	INSERT INTO dbo.visitor_type_master (code, name)
	VALUES
		('NORMAL', 'Normal Visitor'),
		('VENDOR', 'Vendor'),
		('VIP', 'VIP Visitor'),
		('SCHOOL_TRIP', 'School Trip'),
		('COLLEGE_TRIP', 'College Trip');
END
GO

IF OBJECT_ID('dbo.purpose_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.purpose_master (
		purpose_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		code NVARCHAR(40) NOT NULL UNIQUE,
		name NVARCHAR(120) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_purpose_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_purpose_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.purpose_master)
BEGIN
	INSERT INTO dbo.purpose_master (code, name)
	VALUES
		('MEETING', 'Meeting'),
		('DELIVERY', 'Delivery'),
		('INSTALLATION', 'Installation'),
		('MAINTENANCE', 'Maintenance'),
		('INTERVIEW', 'Interview'),
		('AUDIT', 'Audit'),
		('TRAINING', 'Training'),
		('INDUSTRIAL_VISIT', 'Industrial Visit'),
		('CLIENT_DISCUSSION', 'Client Discussion'),
		('OTHER', 'Other');
END
GO

CREATE OR ALTER PROCEDURE dbo.Purpose_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @PurposeId INT = @XMLData.value('(/Purpose/PurposeId)[1]', 'INT');

	IF @PurposeId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Purposes fetched' AS Message,
				JSON_QUERY((
					SELECT
						purpose_id AS PurposeId,
						code AS Code,
						name AS Name,
						is_active AS IsActive
					FROM dbo.purpose_master
					ORDER BY purpose_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.purpose_master WHERE purpose_id = @PurposeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Purpose not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Purposes fetched' AS Message,
			JSON_QUERY((
				SELECT
					purpose_id AS PurposeId,
					code AS Code,
					name AS Name,
					is_active AS IsActive
				FROM dbo.purpose_master
				WHERE purpose_id = @PurposeId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Purpose_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Code NVARCHAR(40) = @XMLData.value('(/Purpose/Code)[1]', 'NVARCHAR(40)');
	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Purpose/Name)[1]', 'NVARCHAR(120)');

	IF @Code IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Code and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.purpose_master WHERE code = @Code)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Purpose code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.purpose_master (code, name)
	VALUES (@Code, @Name);

	DECLARE @PurposeId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Purpose created' AS Message, @PurposeId AS PurposeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.employee_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.employee_master (
		employee_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		name NVARCHAR(120) NOT NULL,
		department NVARCHAR(120) NOT NULL,
		department_id INT NULL,
		designation NVARCHAR(120) NOT NULL,
		mobile NVARCHAR(20) NOT NULL,
		email NVARCHAR(160) NOT NULL,
		is_department_head BIT NOT NULL CONSTRAINT DF_employee_master_is_department_head DEFAULT (0),
		approval_required BIT NOT NULL CONSTRAINT DF_employee_master_approval_required DEFAULT (0),
		is_active BIT NOT NULL CONSTRAINT DF_employee_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_employee_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF COL_LENGTH('dbo.employee_master', 'department_id') IS NULL
BEGIN
	ALTER TABLE dbo.employee_master
	ADD department_id INT NULL;
END
GO

IF COL_LENGTH('dbo.employee_master', 'is_department_head') IS NULL
BEGIN
	ALTER TABLE dbo.employee_master
	ADD is_department_head BIT NOT NULL
		CONSTRAINT DF_employee_master_is_department_head DEFAULT (0);
END
GO

IF OBJECT_ID('dbo.department_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.department_master (
		department_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		name NVARCHAR(120) NOT NULL UNIQUE,
		is_active BIT NOT NULL CONSTRAINT DF_department_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_department_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF OBJECT_ID('dbo.employee_master', 'U') IS NOT NULL
	AND OBJECT_ID('dbo.department_master', 'U') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = 'FK_employee_master_department'
	)
BEGIN
	ALTER TABLE dbo.employee_master WITH NOCHECK
	ADD CONSTRAINT FK_employee_master_department
		FOREIGN KEY (department_id)
		REFERENCES dbo.department_master (department_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.department_master)
BEGIN
	INSERT INTO dbo.department_master (name)
	VALUES
		('HR'),
		('IT'),
		('Admin'),
		('Production'),
		('Security'),
		('Finance'),
		('Management');
END
GO

CREATE OR ALTER PROCEDURE dbo.Department_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DepartmentId INT = @XMLData.value('(/Department/DepartmentId)[1]', 'INT');

	IF @DepartmentId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Departments fetched' AS Message,
				JSON_QUERY((
					SELECT
						department_id AS DepartmentId,
						name AS Name,
						is_active AS IsActive
					FROM dbo.department_master
					ORDER BY department_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.department_master WHERE department_id = @DepartmentId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Departments fetched' AS Message,
			JSON_QUERY((
				SELECT
					department_id AS DepartmentId,
					name AS Name,
					is_active AS IsActive
				FROM dbo.department_master
				WHERE department_id = @DepartmentId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Department_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Department/Name)[1]', 'NVARCHAR(120)');

	IF @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Name is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.department_master WHERE name = @Name)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department name already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.department_master (name)
	VALUES (@Name);

	DECLARE @DepartmentId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Department created' AS Message, @DepartmentId AS DepartmentId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Department_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DepartmentId INT = @XMLData.value('(/Department/DepartmentId)[1]', 'INT');
	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Department/Name)[1]', 'NVARCHAR(120)');

	IF @DepartmentId IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'DepartmentId and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.department_master WHERE department_id = @DepartmentId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.department_master WHERE name = @Name AND department_id <> @DepartmentId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department name already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.department_master
	SET name = @Name,
		updated_at = SYSUTCDATETIME()
	WHERE department_id = @DepartmentId;

	SELECT (
		SELECT 'S' AS Success, 'Department updated' AS Message, @DepartmentId AS DepartmentId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Department_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DepartmentId INT = @XMLData.value('(/Department/DepartmentId)[1]', 'INT');

	IF @DepartmentId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'DepartmentId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.department_master WHERE department_id = @DepartmentId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.department_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE department_id = @DepartmentId;

	SELECT (
		SELECT 'S' AS Success, 'Department deleted' AS Message, @DepartmentId AS DepartmentId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.designation_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.designation_master (
		designation_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		name NVARCHAR(120) NOT NULL UNIQUE,
		is_active BIT NOT NULL CONSTRAINT DF_designation_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_designation_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

CREATE OR ALTER PROCEDURE dbo.Designation_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DesignationId INT = @XMLData.value('(/Designation/DesignationId)[1]', 'INT');

	IF @DesignationId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Designations fetched' AS Message,
				JSON_QUERY((
					SELECT
						designation_id AS DesignationId,
						name AS Name,
						is_active AS IsActive
					FROM dbo.designation_master
					ORDER BY designation_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.designation_master WHERE designation_id = @DesignationId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Designation not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Designations fetched' AS Message,
			JSON_QUERY((
				SELECT
					designation_id AS DesignationId,
					name AS Name,
					is_active AS IsActive
				FROM dbo.designation_master
				WHERE designation_id = @DesignationId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Designation_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Designation/Name)[1]', 'NVARCHAR(120)');

	IF @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Name is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.designation_master WHERE name = @Name)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Designation name already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.designation_master (name)
	VALUES (@Name);

	DECLARE @DesignationId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Designation created' AS Message, @DesignationId AS DesignationId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Designation_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DesignationId INT = @XMLData.value('(/Designation/DesignationId)[1]', 'INT');
	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Designation/Name)[1]', 'NVARCHAR(120)');

	IF @DesignationId IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'DesignationId and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.designation_master WHERE designation_id = @DesignationId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Designation not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.designation_master WHERE name = @Name AND designation_id <> @DesignationId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Designation name already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.designation_master
	SET name = @Name,
		updated_at = SYSUTCDATETIME()
	WHERE designation_id = @DesignationId;

	SELECT (
		SELECT 'S' AS Success, 'Designation updated' AS Message, @DesignationId AS DesignationId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Designation_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DesignationId INT = @XMLData.value('(/Designation/DesignationId)[1]', 'INT');

	IF @DesignationId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'DesignationId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.designation_master WHERE designation_id = @DesignationId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Designation not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.designation_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE designation_id = @DesignationId;

	SELECT (
		SELECT 'S' AS Success, 'Designation deleted' AS Message, @DesignationId AS DesignationId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.id_proof_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.id_proof_master (
		id_proof_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		name NVARCHAR(120) NOT NULL UNIQUE,
		is_active BIT NOT NULL CONSTRAINT DF_id_proof_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_id_proof_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.id_proof_master)
BEGIN
	INSERT INTO dbo.id_proof_master (name)
	VALUES
		('Aadhar Card'),
		('Driving License'),
		('PAN Card'),
		('Passport'),
		('College ID'),
		('School ID'),
		('Other');
END
GO

CREATE OR ALTER PROCEDURE dbo.IdProof_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @IdProofId INT = @XMLData.value('(/IdProof/IdProofId)[1]', 'INT');

	IF @IdProofId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Id proofs fetched' AS Message,
				JSON_QUERY((
					SELECT
						id_proof_id AS IdProofId,
						name AS Name,
						is_active AS IsActive
					FROM dbo.id_proof_master
					ORDER BY id_proof_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.id_proof_master WHERE id_proof_id = @IdProofId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Id proof not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Id proofs fetched' AS Message,
			JSON_QUERY((
				SELECT
					id_proof_id AS IdProofId,
					name AS Name,
					is_active AS IsActive
				FROM dbo.id_proof_master
				WHERE id_proof_id = @IdProofId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.IdProof_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/IdProof/Name)[1]', 'NVARCHAR(120)');

	IF @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Name is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.id_proof_master WHERE name = @Name)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Id proof name already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.id_proof_master (name)
	VALUES (@Name);

	DECLARE @IdProofId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Id proof created' AS Message, @IdProofId AS IdProofId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.IdProof_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @IdProofId INT = @XMLData.value('(/IdProof/IdProofId)[1]', 'INT');
	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/IdProof/Name)[1]', 'NVARCHAR(120)');

	IF @IdProofId IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'IdProofId and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.id_proof_master WHERE id_proof_id = @IdProofId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Id proof not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.id_proof_master WHERE name = @Name AND id_proof_id <> @IdProofId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Id proof name already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.id_proof_master
	SET name = @Name,
		updated_at = SYSUTCDATETIME()
	WHERE id_proof_id = @IdProofId;

	SELECT (
		SELECT 'S' AS Success, 'Id proof updated' AS Message, @IdProofId AS IdProofId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.IdProof_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @IdProofId INT = @XMLData.value('(/IdProof/IdProofId)[1]', 'INT');

	IF @IdProofId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'IdProofId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.id_proof_master WHERE id_proof_id = @IdProofId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Id proof not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.id_proof_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE id_proof_id = @IdProofId;

	SELECT (
		SELECT 'S' AS Success, 'Id proof deleted' AS Message, @IdProofId AS IdProofId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.badge_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.badge_master (
		badge_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		code NVARCHAR(30) NOT NULL UNIQUE,
		color NVARCHAR(40) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_badge_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_badge_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.badge_master)
BEGIN
	INSERT INTO dbo.badge_master (code, color)
	VALUES
		('NORMAL', 'White'),
		('VENDOR', 'Yellow'),
		('VIP', 'Red'),
		('TRIP', 'Blue');
END
GO

CREATE OR ALTER PROCEDURE dbo.Badge_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @BadgeId INT = @XMLData.value('(/Badge/BadgeId)[1]', 'INT');

	IF @BadgeId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Badges fetched' AS Message,
				JSON_QUERY((
					SELECT
						badge_id AS BadgeId,
						code AS Code,
						color AS Color,
						is_active AS IsActive
					FROM dbo.badge_master
					ORDER BY badge_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.badge_master WHERE badge_id = @BadgeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Badge not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Badges fetched' AS Message,
			JSON_QUERY((
				SELECT
					badge_id AS BadgeId,
					code AS Code,
					color AS Color,
					is_active AS IsActive
				FROM dbo.badge_master
				WHERE badge_id = @BadgeId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Badge_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Code NVARCHAR(30) = @XMLData.value('(/Badge/Code)[1]', 'NVARCHAR(30)');
	DECLARE @Color NVARCHAR(40) = @XMLData.value('(/Badge/Color)[1]', 'NVARCHAR(40)');

	IF @Code IS NULL OR @Color IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Code and Color are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.badge_master WHERE code = @Code)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Badge code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.badge_master (code, color)
	VALUES (@Code, @Color);

	DECLARE @BadgeId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Badge created' AS Message, @BadgeId AS BadgeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Badge_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @BadgeId INT = @XMLData.value('(/Badge/BadgeId)[1]', 'INT');
	DECLARE @Code NVARCHAR(30) = @XMLData.value('(/Badge/Code)[1]', 'NVARCHAR(30)');
	DECLARE @Color NVARCHAR(40) = @XMLData.value('(/Badge/Color)[1]', 'NVARCHAR(40)');

	IF @BadgeId IS NULL OR @Code IS NULL OR @Color IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'BadgeId, Code, and Color are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.badge_master WHERE badge_id = @BadgeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Badge not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.badge_master WHERE code = @Code AND badge_id <> @BadgeId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Badge code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.badge_master
	SET code = @Code,
		color = @Color,
		updated_at = SYSUTCDATETIME()
	WHERE badge_id = @BadgeId;

	SELECT (
		SELECT 'S' AS Success, 'Badge updated' AS Message, @BadgeId AS BadgeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Badge_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @BadgeId INT = @XMLData.value('(/Badge/BadgeId)[1]', 'INT');

	IF @BadgeId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'BadgeId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.badge_master WHERE badge_id = @BadgeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Badge not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.badge_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE badge_id = @BadgeId;

	SELECT (
		SELECT 'S' AS Success, 'Badge deleted' AS Message, @BadgeId AS BadgeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.approval_rule_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.approval_rule_master (
		rule_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		visitor_type_code NVARCHAR(30) NOT NULL UNIQUE,
		approval_status NVARCHAR(40) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_approval_rule_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_approval_rule_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.approval_rule_master)
BEGIN
	INSERT INTO dbo.approval_rule_master (visitor_type_code, approval_status)
	VALUES
		('NORMAL', 'Approval Required'),
		('VENDOR', 'Approval Required'),
		('VIP', 'Auto Approved'),
		('SCHOOL_TRIP', 'Pre Approved'),
		('COLLEGE_TRIP', 'Pre Approved');
END
GO

CREATE OR ALTER PROCEDURE dbo.ApprovalRule_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @RuleId INT = @XMLData.value('(/ApprovalRule/RuleId)[1]', 'INT');

	IF @RuleId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Approval rules fetched' AS Message,
				JSON_QUERY((
					SELECT
						rule_id AS RuleId,
						visitor_type_code AS VisitorTypeCode,
						approval_status AS ApprovalStatus,
						is_active AS IsActive
					FROM dbo.approval_rule_master
					ORDER BY rule_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.approval_rule_master WHERE rule_id = @RuleId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Approval rule not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Approval rules fetched' AS Message,
			JSON_QUERY((
				SELECT
					rule_id AS RuleId,
					visitor_type_code AS VisitorTypeCode,
					approval_status AS ApprovalStatus,
					is_active AS IsActive
				FROM dbo.approval_rule_master
				WHERE rule_id = @RuleId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.ApprovalRule_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @VisitorTypeCode NVARCHAR(30) =
		@XMLData.value('(/ApprovalRule/VisitorTypeCode)[1]', 'NVARCHAR(30)');
	DECLARE @ApprovalStatus NVARCHAR(40) =
		@XMLData.value('(/ApprovalRule/ApprovalStatus)[1]', 'NVARCHAR(40)');

	IF @VisitorTypeCode IS NULL OR @ApprovalStatus IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'VisitorTypeCode and ApprovalStatus are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.approval_rule_master WHERE visitor_type_code = @VisitorTypeCode)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type already mapped' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.approval_rule_master (visitor_type_code, approval_status)
	VALUES (@VisitorTypeCode, @ApprovalStatus);

	DECLARE @RuleId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Approval rule created' AS Message, @RuleId AS RuleId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.ApprovalRule_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @RuleId INT = @XMLData.value('(/ApprovalRule/RuleId)[1]', 'INT');
	DECLARE @VisitorTypeCode NVARCHAR(30) =
		@XMLData.value('(/ApprovalRule/VisitorTypeCode)[1]', 'NVARCHAR(30)');
	DECLARE @ApprovalStatus NVARCHAR(40) =
		@XMLData.value('(/ApprovalRule/ApprovalStatus)[1]', 'NVARCHAR(40)');

	IF @RuleId IS NULL OR @VisitorTypeCode IS NULL OR @ApprovalStatus IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'RuleId, VisitorTypeCode, and ApprovalStatus are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.approval_rule_master WHERE rule_id = @RuleId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Approval rule not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.approval_rule_master
		WHERE visitor_type_code = @VisitorTypeCode AND rule_id <> @RuleId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type already mapped' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.approval_rule_master
	SET visitor_type_code = @VisitorTypeCode,
		approval_status = @ApprovalStatus,
		updated_at = SYSUTCDATETIME()
	WHERE rule_id = @RuleId;

	SELECT (
		SELECT 'S' AS Success, 'Approval rule updated' AS Message, @RuleId AS RuleId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.ApprovalRule_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @RuleId INT = @XMLData.value('(/ApprovalRule/RuleId)[1]', 'INT');

	IF @RuleId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'RuleId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.approval_rule_master WHERE rule_id = @RuleId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Approval rule not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.approval_rule_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE rule_id = @RuleId;

	SELECT (
		SELECT 'S' AS Success, 'Approval rule deleted' AS Message, @RuleId AS RuleId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

IF OBJECT_ID('dbo.time_policy_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.time_policy_master (
		policy_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		visitor_type_code NVARCHAR(30) NOT NULL UNIQUE,
		policy_label NVARCHAR(40) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_time_policy_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_time_policy_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.time_policy_master)
BEGIN
	INSERT INTO dbo.time_policy_master (visitor_type_code, policy_label)
	VALUES
		('NORMAL', '2 Hours'),
		('VENDOR', '4 Hours'),
		('VIP', 'Unlimited'),
		('TRIP', 'Fixed Slot');
END
GO

CREATE OR ALTER PROCEDURE dbo.TimePolicy_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @PolicyId INT = @XMLData.value('(/TimePolicy/PolicyId)[1]', 'INT');

	IF @PolicyId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Time policies fetched' AS Message,
				JSON_QUERY((
					SELECT
						policy_id AS PolicyId,
						visitor_type_code AS VisitorTypeCode,
						policy_label AS PolicyLabel,
						is_active AS IsActive
					FROM dbo.time_policy_master
					ORDER BY policy_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.time_policy_master WHERE policy_id = @PolicyId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Time policy not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Time policies fetched' AS Message,
			JSON_QUERY((
				SELECT
					policy_id AS PolicyId,
					visitor_type_code AS VisitorTypeCode,
					policy_label AS PolicyLabel,
					is_active AS IsActive
				FROM dbo.time_policy_master
				WHERE policy_id = @PolicyId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.TimePolicy_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @VisitorTypeCode NVARCHAR(30) =
		@XMLData.value('(/TimePolicy/VisitorTypeCode)[1]', 'NVARCHAR(30)');
	DECLARE @PolicyLabel NVARCHAR(40) =
		@XMLData.value('(/TimePolicy/PolicyLabel)[1]', 'NVARCHAR(40)');

	IF @VisitorTypeCode IS NULL OR @PolicyLabel IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'VisitorTypeCode and PolicyLabel are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.time_policy_master WHERE visitor_type_code = @VisitorTypeCode)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type already mapped' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.time_policy_master (visitor_type_code, policy_label)
	VALUES (@VisitorTypeCode, @PolicyLabel);

	DECLARE @PolicyId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Time policy created' AS Message, @PolicyId AS PolicyId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.TimePolicy_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @PolicyId INT = @XMLData.value('(/TimePolicy/PolicyId)[1]', 'INT');
	DECLARE @VisitorTypeCode NVARCHAR(30) =
		@XMLData.value('(/TimePolicy/VisitorTypeCode)[1]', 'NVARCHAR(30)');
	DECLARE @PolicyLabel NVARCHAR(40) =
		@XMLData.value('(/TimePolicy/PolicyLabel)[1]', 'NVARCHAR(40)');

	IF @PolicyId IS NULL OR @VisitorTypeCode IS NULL OR @PolicyLabel IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'PolicyId, VisitorTypeCode, and PolicyLabel are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.time_policy_master WHERE policy_id = @PolicyId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Time policy not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.time_policy_master
		WHERE visitor_type_code = @VisitorTypeCode AND policy_id <> @PolicyId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type already mapped' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.time_policy_master
	SET visitor_type_code = @VisitorTypeCode,
		policy_label = @PolicyLabel,
		updated_at = SYSUTCDATETIME()
	WHERE policy_id = @PolicyId;

	SELECT (
		SELECT 'S' AS Success, 'Time policy updated' AS Message, @PolicyId AS PolicyId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.TimePolicy_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @PolicyId INT = @XMLData.value('(/TimePolicy/PolicyId)[1]', 'INT');

	IF @PolicyId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'PolicyId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.time_policy_master WHERE policy_id = @PolicyId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Time policy not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.time_policy_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE policy_id = @PolicyId;

	SELECT (
		SELECT 'S' AS Success, 'Time policy deleted' AS Message, @PolicyId AS PolicyId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Employee_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @EmployeeId INT = @XMLData.value('(/Employee/EmployeeId)[1]', 'INT');

	IF @EmployeeId IS NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Employees fetched' AS Message,
				JSON_QUERY((
					SELECT
						employee_id AS EmployeeId,
						name AS Name,
						department AS Department,
						department_id AS DepartmentId,
						designation AS Designation,
						mobile AS Mobile,
						email AS Email,
						is_department_head AS IsDepartmentHead,
						approval_required AS ApprovalRequired,
						is_active AS IsActive
					FROM dbo.employee_master
					ORDER BY employee_id DESC
					FOR JSON PATH
				)) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.employee_master WHERE employee_id = @EmployeeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Employee not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Employees fetched' AS Message,
			JSON_QUERY((
				SELECT
					employee_id AS EmployeeId,
					name AS Name,
					department AS Department,
					department_id AS DepartmentId,
					designation AS Designation,
					mobile AS Mobile,
					email AS Email,
					is_department_head AS IsDepartmentHead,
					approval_required AS ApprovalRequired,
					is_active AS IsActive
				FROM dbo.employee_master
				WHERE employee_id = @EmployeeId
				FOR JSON PATH
			)) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Employee_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Employee/Name)[1]', 'NVARCHAR(120)');
	DECLARE @Department NVARCHAR(120) = @XMLData.value('(/Employee/Department)[1]', 'NVARCHAR(120)');
	DECLARE @DepartmentId INT = @XMLData.value('(/Employee/DepartmentId)[1]', 'INT');
	DECLARE @Designation NVARCHAR(120) = @XMLData.value('(/Employee/Designation)[1]', 'NVARCHAR(120)');
	DECLARE @Mobile NVARCHAR(20) = @XMLData.value('(/Employee/Mobile)[1]', 'NVARCHAR(20)');
	DECLARE @Email NVARCHAR(160) = @XMLData.value('(/Employee/Email)[1]', 'NVARCHAR(160)');
	DECLARE @IsDepartmentHead BIT = @XMLData.value('(/Employee/IsDepartmentHead)[1]', 'BIT');
	DECLARE @ApprovalRequired BIT = @XMLData.value('(/Employee/ApprovalRequired)[1]', 'BIT');

	IF @Name IS NULL OR @Department IS NULL OR @DepartmentId IS NULL OR @Designation IS NULL OR @Mobile IS NULL OR @Email IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'All employee fields are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (
		SELECT 1
		FROM dbo.department_master
		WHERE department_id = @DepartmentId AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.employee_master (
		name,
		department,
		department_id,
		designation,
		mobile,
		email,
		is_department_head,
		approval_required
	)
	VALUES (
		@Name,
		@Department,
		@DepartmentId,
		@Designation,
		@Mobile,
		@Email,
		ISNULL(@IsDepartmentHead, 0),
		ISNULL(@ApprovalRequired, 0)
	);

	DECLARE @EmployeeId INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Employee created' AS Message, @EmployeeId AS EmployeeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Employee_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @EmployeeId INT = @XMLData.value('(/Employee/EmployeeId)[1]', 'INT');
	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Employee/Name)[1]', 'NVARCHAR(120)');
	DECLARE @Department NVARCHAR(120) = @XMLData.value('(/Employee/Department)[1]', 'NVARCHAR(120)');
	DECLARE @DepartmentId INT = @XMLData.value('(/Employee/DepartmentId)[1]', 'INT');
	DECLARE @Designation NVARCHAR(120) = @XMLData.value('(/Employee/Designation)[1]', 'NVARCHAR(120)');
	DECLARE @Mobile NVARCHAR(20) = @XMLData.value('(/Employee/Mobile)[1]', 'NVARCHAR(20)');
	DECLARE @Email NVARCHAR(160) = @XMLData.value('(/Employee/Email)[1]', 'NVARCHAR(160)');
	DECLARE @IsDepartmentHead BIT = @XMLData.value('(/Employee/IsDepartmentHead)[1]', 'BIT');
	DECLARE @ApprovalRequired BIT = @XMLData.value('(/Employee/ApprovalRequired)[1]', 'BIT');

	IF @EmployeeId IS NULL OR @Name IS NULL OR @Department IS NULL OR @DepartmentId IS NULL OR @Designation IS NULL OR @Mobile IS NULL OR @Email IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'All employee fields are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (
		SELECT 1
		FROM dbo.department_master
		WHERE department_id = @DepartmentId AND is_active = 1
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.employee_master WHERE employee_id = @EmployeeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Employee not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.employee_master
	SET name = @Name,
		department = @Department,
		department_id = @DepartmentId,
		designation = @Designation,
		mobile = @Mobile,
		email = @Email,
		is_department_head = ISNULL(@IsDepartmentHead, is_department_head),
		approval_required = ISNULL(@ApprovalRequired, approval_required),
		updated_at = SYSUTCDATETIME()
	WHERE employee_id = @EmployeeId;

	SELECT (
		SELECT 'S' AS Success, 'Employee updated' AS Message, @EmployeeId AS EmployeeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Approver_Resolve_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @HostEmployeeId INT = @XMLData.value('(/Approval/HostEmployeeId)[1]', 'INT');
	DECLARE @DepartmentId INT;
	DECLARE @HeadEmployeeId INT;
	DECLARE @AdminUserId NVARCHAR(50);

	IF @HostEmployeeId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'HostEmployeeId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT @DepartmentId = department_id
	FROM dbo.employee_master
	WHERE employee_id = @HostEmployeeId AND is_active = 1;

	IF @DepartmentId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Host employee department not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT TOP (1) @HeadEmployeeId = employee_id
	FROM dbo.employee_master
	WHERE department_id = @DepartmentId
		AND is_department_head = 1
		AND is_active = 1
	ORDER BY employee_id DESC;

	IF @HeadEmployeeId IS NOT NULL
	BEGIN
		SELECT (
			SELECT
				'S' AS Success,
				'Approver resolved' AS Message,
				'DEPARTMENT_HEAD' AS ApproverType,
				@HeadEmployeeId AS ApproverEmployeeId
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT TOP (1) @AdminUserId = user_id
	FROM dbo.user_profile
	WHERE role = 'ADMIN' AND is_active = 1
	ORDER BY created_at DESC;

	IF @AdminUserId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Admin user not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT
			'S' AS Success,
			'Approver resolved' AS Message,
			'ADMIN' AS ApproverType,
			@AdminUserId AS ApproverUserId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Employee_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @EmployeeId INT = @XMLData.value('(/Employee/EmployeeId)[1]', 'INT');

	IF @EmployeeId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'EmployeeId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.employee_master WHERE employee_id = @EmployeeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Employee not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.employee_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE employee_id = @EmployeeId;

	SELECT (
		SELECT 'S' AS Success, 'Employee deleted' AS Message, @EmployeeId AS EmployeeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Purpose_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @PurposeId INT = @XMLData.value('(/Purpose/PurposeId)[1]', 'INT');
	DECLARE @Code NVARCHAR(40) = @XMLData.value('(/Purpose/Code)[1]', 'NVARCHAR(40)');
	DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Purpose/Name)[1]', 'NVARCHAR(120)');

	IF @PurposeId IS NULL OR @Code IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'PurposeId, Code, and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.purpose_master WHERE purpose_id = @PurposeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Purpose not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.purpose_master WHERE code = @Code AND purpose_id <> @PurposeId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Purpose code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.purpose_master
	SET code = @Code,
		name = @Name,
		updated_at = SYSUTCDATETIME()
	WHERE purpose_id = @PurposeId;

	SELECT (
		SELECT 'S' AS Success, 'Purpose updated' AS Message, @PurposeId AS PurposeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.Purpose_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @PurposeId INT = @XMLData.value('(/Purpose/PurposeId)[1]', 'INT');

	IF @PurposeId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'PurposeId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.purpose_master WHERE purpose_id = @PurposeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Purpose not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.purpose_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE purpose_id = @PurposeId;

	SELECT (
		SELECT 'S' AS Success, 'Purpose deleted' AS Message, @PurposeId AS PurposeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO
