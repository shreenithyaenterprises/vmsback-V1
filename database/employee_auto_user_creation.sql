-- =============================================
-- AUTOMATIC USER CREATION FOR EMPLOYEES
-- This script adds functionality to automatically create
-- user login credentials when an employee is created
-- =============================================

USE PremiumVms;
GO

-- Step 1: Add employee_id reference to user_profile table (optional - for linking)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.user_profile') 
    AND name = 'employee_id'
)
BEGIN
    ALTER TABLE dbo.user_profile
    ADD employee_id INT NULL;

    -- Add foreign key constraint
    ALTER TABLE dbo.user_profile
    ADD CONSTRAINT FK_user_profile_employee
    FOREIGN KEY (employee_id) REFERENCES dbo.employee_master(employee_id);
END
GO

-- Step 2: Create stored procedure for user profile creation
CREATE OR ALTER PROCEDURE dbo.UserProfile_Create_SP
    @XMLData XML
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId NVARCHAR(50) = @XMLData.value('(/UserProfile/UserId)[1]', 'NVARCHAR(50)');
    DECLARE @Password NVARCHAR(200) = @XMLData.value('(/UserProfile/Password)[1]', 'NVARCHAR(200)');
    DECLARE @Role NVARCHAR(50) = @XMLData.value('(/UserProfile/Role)[1]', 'NVARCHAR(50)');
    DECLARE @EmployeeId INT = @XMLData.value('(/UserProfile/EmployeeId)[1]', 'INT');

    -- Validate required fields
    IF @UserId IS NULL OR @Password IS NULL OR @Role IS NULL
    BEGIN
        SELECT (
            SELECT 'E' AS Success, 'UserId, Password and Role are required' AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
        RETURN;
    END

    -- Check if user already exists
    IF EXISTS (SELECT 1 FROM dbo.user_profile WHERE user_id = @UserId)
    BEGIN
        SELECT (
            SELECT 'E' AS Success, 'User ID already exists' AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
        RETURN;
    END

    -- Check if employee_id is already linked to another user
    IF @EmployeeId IS NOT NULL AND EXISTS (
        SELECT 1 FROM dbo.user_profile WHERE employee_id = @EmployeeId
    )
    BEGIN
        SELECT (
            SELECT 'E' AS Success, 'This employee already has a user account' AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
        RETURN;
    END

    -- Generate password hash
    DECLARE @Hash VARBINARY(32) = HASHBYTES('SHA2_256', CONCAT(@UserId, '|', @Password));

    -- Insert new user
    INSERT INTO dbo.user_profile (user_id, password_hash, role, employee_id, is_active)
    VALUES (@UserId, @Hash, @Role, @EmployeeId, 1);

    -- Return success
    SELECT (
        SELECT 
            'S' AS Success, 
            'User profile created successfully' AS Message,
            @UserId AS UserId,
            @Password AS GeneratedPassword,
            @Role AS Role
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ) AS ReturnValue;
END
GO

-- Step 3: Create helper function to generate user ID from email
CREATE OR ALTER FUNCTION dbo.fn_GenerateUserIdFromEmail(@Email NVARCHAR(160))
RETURNS NVARCHAR(50)
AS
BEGIN
    -- Simply use the email as user_id
    -- Alternative: Use email prefix before @ symbol
    -- DECLARE @UserId NVARCHAR(50) = LEFT(@Email, CHARINDEX('@', @Email) - 1);
    RETURN @Email;
END
GO

-- Step 4: Create helper function to generate default password
CREATE OR ALTER FUNCTION dbo.fn_GenerateDefaultPassword(@EmployeeName NVARCHAR(120))
RETURNS NVARCHAR(50)
AS
BEGIN
    -- Generate a simple default password
    -- Format: FirstName@123
    DECLARE @FirstName NVARCHAR(50) = LEFT(@EmployeeName, CHARINDEX(' ', @EmployeeName + ' ') - 1);
    DECLARE @Password NVARCHAR(50) = @FirstName + '@123';
    RETURN @Password;
END
GO

-- Step 5: MODIFIED Employee_Create_SP with auto user creation
CREATE OR ALTER PROCEDURE dbo.Employee_Create_SP_WithUser
    @XMLData XML
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Parse employee data
        DECLARE @Name NVARCHAR(120) = @XMLData.value('(/Employee/Name)[1]', 'NVARCHAR(120)');
        DECLARE @Department NVARCHAR(120) = @XMLData.value('(/Employee/Department)[1]', 'NVARCHAR(120)');
        DECLARE @DepartmentId INT = @XMLData.value('(/Employee/DepartmentId)[1]', 'INT');
        DECLARE @Designation NVARCHAR(120) = @XMLData.value('(/Employee/Designation)[1]', 'NVARCHAR(120)');
        DECLARE @Mobile NVARCHAR(20) = @XMLData.value('(/Employee/Mobile)[1]', 'NVARCHAR(20)');
        DECLARE @Email NVARCHAR(160) = @XMLData.value('(/Employee/Email)[1]', 'NVARCHAR(160)');
        DECLARE @IsDepartmentHead BIT = @XMLData.value('(/Employee/IsDepartmentHead)[1]', 'BIT');
        DECLARE @ApprovalRequired BIT = @XMLData.value('(/Employee/ApprovalRequired)[1]', 'BIT');
        DECLARE @CreateUser BIT = @XMLData.value('(/Employee/CreateUser)[1]', 'BIT'); -- NEW: Flag to create user

        -- Validate required fields
        IF @Name IS NULL OR @Department IS NULL OR @DepartmentId IS NULL 
           OR @Designation IS NULL OR @Mobile IS NULL OR @Email IS NULL
        BEGIN
            SELECT (
                SELECT 'E' AS Success, 'All employee fields are required' AS Message
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            ) AS ReturnValue;
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- Check if department exists
        IF NOT EXISTS (
            SELECT 1 FROM dbo.department_master
            WHERE department_id = @DepartmentId AND is_active = 1
        )
        BEGIN
            SELECT (
                SELECT 'E' AS Success, 'Department not found' AS Message
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            ) AS ReturnValue;
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- Insert employee
        INSERT INTO dbo.employee_master (
            name, department, department_id, designation, mobile, email,
            is_department_head, approval_required
        )
        VALUES (
            @Name, @Department, @DepartmentId, @Designation, @Mobile, @Email,
            ISNULL(@IsDepartmentHead, 0), ISNULL(@ApprovalRequired, 0)
        );

        DECLARE @EmployeeId INT = SCOPE_IDENTITY();

        -- Auto-create user if flag is set (default: true)
        DECLARE @UserId NVARCHAR(50) = NULL;
        DECLARE @GeneratedPassword NVARCHAR(50) = NULL;
        DECLARE @Role NVARCHAR(50) = 'EMPLOYEE';

        IF ISNULL(@CreateUser, 1) = 1
        BEGIN
            -- Generate UserId from email
            SET @UserId = dbo.fn_GenerateUserIdFromEmail(@Email);
            
            -- Generate default password
            SET @GeneratedPassword = dbo.fn_GenerateDefaultPassword(@Name);
            
            -- Set role based on department head status
            IF @IsDepartmentHead = 1
                SET @Role = 'MANAGER';

            -- Check if user already exists
            IF NOT EXISTS (SELECT 1 FROM dbo.user_profile WHERE user_id = @UserId)
            BEGIN
                DECLARE @Hash VARBINARY(32) = HASHBYTES('SHA2_256', CONCAT(@UserId, '|', @GeneratedPassword));
                
                INSERT INTO dbo.user_profile (user_id, password_hash, role, employee_id, is_active)
                VALUES (@UserId, @Hash, @Role, @EmployeeId, 1);
            END
        END

        COMMIT TRANSACTION;

        -- Return success with user credentials
        SELECT (
            SELECT 
                'S' AS Success, 
                'Employee created successfully' AS Message, 
                @EmployeeId AS EmployeeId,
                @UserId AS UserId,
                @GeneratedPassword AS GeneratedPassword,
                @Role AS Role,
                CASE WHEN @UserId IS NOT NULL THEN 'User login created' ELSE 'Employee only created' END AS UserStatus
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT (
            SELECT 'E' AS Success, ERROR_MESSAGE() AS Message
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnValue;
    END CATCH
END
GO

PRINT 'Employee auto user creation setup completed successfully!';
PRINT '';
PRINT '=== USAGE INSTRUCTIONS ===';
PRINT '1. Run this script in your PremiumVms database';
PRINT '2. Use Employee_Create_SP_WithUser instead of Employee_Create_SP';
PRINT '3. Or manually call UserProfile_Create_SP after creating employee';
PRINT '';
PRINT '=== DEFAULT CREDENTIALS FORMAT ===';
PRINT 'UserId: Employee Email (e.g., akash@gmail.com)';
PRINT 'Password: FirstName@123 (e.g., AKASH@123)';
PRINT 'Role: EMPLOYEE or MANAGER (if department head)';
PRINT '';
PRINT '=== EXAMPLE ===';
PRINT 'Employee: AKASH GAYDHANE (akashgaydhane781@gmail.com)';
PRINT 'Login: akashgaydhane781@gmail.com / AKASH@123';
GO
