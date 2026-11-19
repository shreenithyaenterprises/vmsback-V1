USE PremiumVms;
GO

IF OBJECT_ID('dbo.visitor_type_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.visitor_type_master (
		visitor_type_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		code NVARCHAR(30) NOT NULL UNIQUE,
		name NVARCHAR(100) NOT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_visitor_type_master_is_active DEFAULT (1),
		created_at DATETIME2(0) NOT NULL CONSTRAINT DF_visitor_type_master_created_at DEFAULT (SYSUTCDATETIME()),
		updated_at DATETIME2(0) NULL
	);
END
GO

IF COL_LENGTH('dbo.visitor_type_master', 'updated_at') IS NULL
BEGIN
	ALTER TABLE dbo.visitor_type_master
	ADD updated_at DATETIME2(0) NULL;
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

CREATE OR ALTER PROCEDURE dbo.VisitorType_Create_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @Code NVARCHAR(30) = @XMLData.value('(/VisitorType/Code)[1]', 'NVARCHAR(30)');
	DECLARE @Name NVARCHAR(100) = @XMLData.value('(/VisitorType/Name)[1]', 'NVARCHAR(100)');

	IF @Code IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Code and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (SELECT 1 FROM dbo.visitor_type_master WHERE code = @Code)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	INSERT INTO dbo.visitor_type_master (code, name)
	VALUES (@Code, @Name);

	DECLARE @Id INT = SCOPE_IDENTITY();

	SELECT (
		SELECT 'S' AS Success, 'Visitor type created' AS Message, @Id AS VisitorTypeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.VisitorType_Update_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @VisitorTypeId INT = @XMLData.value('(/VisitorType/VisitorTypeId)[1]', 'INT');
	DECLARE @Code NVARCHAR(30) = @XMLData.value('(/VisitorType/Code)[1]', 'NVARCHAR(30)');
	DECLARE @Name NVARCHAR(100) = @XMLData.value('(/VisitorType/Name)[1]', 'NVARCHAR(100)');

	IF @VisitorTypeId IS NULL OR @Code IS NULL OR @Name IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'VisitorTypeId, Code, and Name are required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.visitor_type_master WHERE visitor_type_id = @VisitorTypeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF EXISTS (
		SELECT 1 FROM dbo.visitor_type_master WHERE code = @Code AND visitor_type_id <> @VisitorTypeId
	)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type code already exists' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.visitor_type_master
	SET code = @Code,
		name = @Name,
		updated_at = SYSUTCDATETIME()
	WHERE visitor_type_id = @VisitorTypeId;

	SELECT (
		SELECT 'S' AS Success, 'Visitor type updated' AS Message, @VisitorTypeId AS VisitorTypeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.VisitorType_Delete_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @VisitorTypeId INT = @XMLData.value('(/VisitorType/VisitorTypeId)[1]', 'INT');

	IF @VisitorTypeId IS NULL
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'VisitorTypeId is required' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	IF NOT EXISTS (SELECT 1 FROM dbo.visitor_type_master WHERE visitor_type_id = @VisitorTypeId)
	BEGIN
		SELECT (
			SELECT 'E' AS Success, 'Visitor type not found' AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	UPDATE dbo.visitor_type_master
	SET is_active = 0,
		updated_at = SYSUTCDATETIME()
	WHERE visitor_type_id = @VisitorTypeId;

	SELECT (
		SELECT 'S' AS Success, 'Visitor type deleted' AS Message, @VisitorTypeId AS VisitorTypeId
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO

CREATE OR ALTER PROCEDURE dbo.VisitorType_Get_SP
	@XMLData XML
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @VisitorTypeId INT = @XMLData.value('(/VisitorType/VisitorTypeId)[1]', 'INT');

	IF @VisitorTypeId IS NULL
	BEGIN
		SELECT (
			SELECT 'S' AS Success,
				'Visitor types fetched' AS Message,
				(
					SELECT visitor_type_id AS VisitorTypeId, code AS Code, name AS Name, is_active AS IsActive
					FROM dbo.visitor_type_master
					ORDER BY name
					FOR JSON PATH
				) AS Items
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
		RETURN;
	END

	SELECT (
		SELECT 'S' AS Success,
			'Visitor type fetched' AS Message,
			(
				SELECT visitor_type_id AS VisitorTypeId, code AS Code, name AS Name, is_active AS IsActive
				FROM dbo.visitor_type_master
				WHERE visitor_type_id = @VisitorTypeId
				FOR JSON PATH
			) AS Items
		FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
	) AS ReturnValue;
END
GO
