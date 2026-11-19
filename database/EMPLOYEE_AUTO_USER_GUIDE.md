# 🔐 Employee Auto User Creation - Implementation Guide

## 📋 Overview
This feature automatically creates user login credentials when an employee is created in the system.

---

## ✅ What This Solves
**Problem**: Employees don't have login credentials, so they can't access the approval system.

**Solution**: When you create an employee, the system automatically:
1. ✅ Creates the employee record
2. ✅ Generates login credentials (UserId + Password)
3. ✅ Creates user profile with appropriate role
4. ✅ Links employee to user account
5. ✅ Returns credentials to admin

---

## 🚀 Implementation Steps

### Step 1: Run Database Script
```bash
# Execute this SQL script in your PremiumVms database
File: API/database/employee_auto_user_creation.sql
```

This will create:
- ✅ `employee_id` column in `user_profile` table (links user to employee)
- ✅ `UserProfile_Create_SP` stored procedure
- ✅ `Employee_Create_SP_WithUser` stored procedure (NEW - with auto user creation)
- ✅ Helper functions for UserId and Password generation

**Default Credentials Format:**
- **UserId**: Employee Email (e.g., `akashgaydhane781@gmail.com`)
- **Password**: `FirstName@123` (e.g., `AKASH@123`)
- **Role**: `EMPLOYEE` or `MANAGER` (if department head)

---

### Step 2: Add New Route (Optional - if you want separate endpoint)

**File**: `API/Routes/master/employee/employee.post.js`

Add this route:
```javascript
import { Router } from 'express';
import { createEmployee } from '../../../controller/master/employee/employee.post.js';
import { createEmployeeWithUser } from '../../../controller/master/employee/employeeWithUser.post.js';

const router = Router();

router.post('/', createEmployee); // Old endpoint (no user creation)
router.post('/with-user', createEmployeeWithUser); // NEW endpoint (with user creation)

export default router;
```

---

### Step 3A: Option 1 - Use New Endpoint (Recommended)

**API Endpoint**: `POST /api/master/employee/with-user`

**Request Body**:
```json
{
  "Name": "AKASH GAYDHANE",
  "Department": "IT",
  "DepartmentId": 1,
  "Designation": "Software Developer",
  "Mobile": "09022652375",
  "Email": "akashgaydhane781@gmail.com",
  "IsDepartmentHead": false,
  "ApprovalRequired": true,
  "CreateUser": true  // ← NEW: Set to false if you don't want user creation
}
```

**Response**:
```json
{
  "success": true,
  "message": "Employee and user created successfully",
  "data": {
    "employeeId": 5,
    "userId": "akashgaydhane781@gmail.com",
    "generatedPassword": "AKASH@123",
    "role": "EMPLOYEE",
    "userStatus": "User login created"
  }
}
```

---

### Step 3B: Option 2 - Replace Existing Employee Creation

**File**: `API/controller/master/employee/employee.post.js`

Replace the stored procedure call from `Employee_Create_SP` to `Employee_Create_SP_WithUser`:

```javascript
// OLD
const result = await executeProcedureXml('Employee_Create_SP', 'main', xmlData);

// NEW
const result = await executeProcedureXml('Employee_Create_SP_WithUser', 'main', xmlData);
```

Update the XML to include `CreateUser` flag:
```javascript
const xmlData = `<Employee>
  <Name>${Name}</Name>
  <Department>${Department}</Department>
  <DepartmentId>${DepartmentId}</DepartmentId>
  <Designation>${Designation}</Designation>
  <Mobile>${Mobile}</Mobile>
  <Email>${Email}</Email>
  <IsDepartmentHead>${IsDepartmentHead || false}</IsDepartmentHead>
  <ApprovalRequired>${ApprovalRequired || false}</ApprovalRequired>
  <CreateUser>true</CreateUser>
</Employee>`;
```

Update the response:
```javascript
return res.status(STATUS_CODES.CREATED).json({
  success: true,
  message: result?.data?.Message || 'Employee created',
  data: {
    employeeId: result?.data?.EmployeeId,
    userId: result?.data?.UserId,
    generatedPassword: result?.data?.GeneratedPassword,
    role: result?.data?.Role,
  },
});
```

---

### Step 4: Update Frontend (Employee Creation Form)

**File**: `UI/src/pages/master/employee/EmployeeMaster.jsx` (or wherever you create employees)

Update the API call to use the new endpoint:

```javascript
// Option 1: Use new endpoint
const response = await fetch('http://localhost:5005/api/master/employee/with-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    Name: name,
    Department: department,
    DepartmentId: departmentId,
    Designation: designation,
    Mobile: mobile,
    Email: email,
    IsDepartmentHead: isDepartmentHead,
    ApprovalRequired: approvalRequired,
    CreateUser: true, // ← Always create user
  }),
});

const data = await response.json();

if (data.success) {
  // Show credentials to admin
  alert(`Employee Created!
UserId: ${data.data.userId}
Password: ${data.data.generatedPassword}
Role: ${data.data.role}

Please share these credentials with the employee.`);
}
```

**Better UX**: Show credentials in a modal with copy buttons:

```jsx
{showCredentials && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-8 max-w-md">
      <h2 className="text-2xl font-bold mb-4">✅ Employee Created!</h2>
      <div className="space-y-3">
        <div className="bg-green-50 p-3 rounded">
          <p className="text-sm text-gray-600">UserId (Email)</p>
          <p className="font-mono font-bold">{credentials.userId}</p>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <p className="text-sm text-gray-600">Password</p>
          <p className="font-mono font-bold">{credentials.generatedPassword}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-sm text-gray-600">Role</p>
          <p className="font-bold">{credentials.role}</p>
        </div>
      </div>
      <p className="text-sm text-red-600 mt-4">
        ⚠️ Please save these credentials! They won't be shown again.
      </p>
      <button
        onClick={() => setShowCredentials(false)}
        className="w-full mt-4 bg-blue-500 text-white py-2 rounded"
      >
        OK, I've Saved It
      </button>
    </div>
  </div>
)}
```

---

## 🧪 Testing the Flow

### Test Case 1: Create Employee with Auto User
```bash
POST http://localhost:5005/api/master/employee/with-user
Content-Type: application/json

{
  "Name": "Test Employee",
  "Department": "IT",
  "DepartmentId": 1,
  "Designation": "Developer",
  "Mobile": "9999999999",
  "Email": "test@example.com",
  "IsDepartmentHead": false,
  "ApprovalRequired": true,
  "CreateUser": true
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Employee and user created successfully",
  "data": {
    "employeeId": 6,
    "userId": "test@example.com",
    "generatedPassword": "Test@123",
    "role": "EMPLOYEE",
    "userStatus": "User login created"
  }
}
```

### Test Case 2: Login with Generated Credentials
```bash
POST http://localhost:5005/api/auth/login
Content-Type: application/json

{
  "UserId": "test@example.com",
  "Password": "Test@123"
}
```

**Expected**: Successful login ✅

### Test Case 3: Check Approval Queue
```bash
# Login as the employee
# Navigate to: http://localhost:5173/prebooking/approvals
```

**Expected**: Employee can now see their approval queue ✅

---

## 🔒 Security Best Practices

1. **Change Password on First Login**: Add logic to force password change
2. **Store Credentials Securely**: Never log passwords in production
3. **Email Credentials**: Send credentials via email instead of showing in UI
4. **Password Complexity**: Modify `fn_GenerateDefaultPassword` for stronger passwords

---

## 📊 Database Schema Changes

```sql
-- user_profile table (UPDATED)
CREATE TABLE dbo.user_profile (
    user_id NVARCHAR(50) NOT NULL PRIMARY KEY,
    password_hash VARBINARY(32) NOT NULL,
    role NVARCHAR(50) NOT NULL,
    employee_id INT NULL,  -- ← NEW: Links to employee_master
    is_active BIT NOT NULL DEFAULT (1),
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NULL,
    password_changed_at DATETIME2(0) NULL,
    CONSTRAINT FK_user_profile_employee 
        FOREIGN KEY (employee_id) REFERENCES dbo.employee_master(employee_id)
);
```

---

## 🎯 Benefits

✅ **No Manual User Creation**: Automatic when employee is created  
✅ **Consistent Credentials**: Follow a standard format  
✅ **Employee-User Linking**: Direct relationship in database  
✅ **Approval System Ready**: Employees can immediately use approvals  
✅ **Admin Convenience**: One step instead of two  

---

## 🔄 Workflow Comparison

### Before (Current):
```
1. Admin creates Employee → Employee record created
2. Admin manually creates User → (Often forgotten!)
3. Employee cannot login → ❌ Problem!
4. Approval queue doesn't work → ❌ Problem!
```

### After (New Workflow):
```
1. Admin creates Employee → Employee + User created automatically ✅
2. System generates credentials → UserId + Password ✅
3. Admin shares credentials with employee
4. Employee logs in → Works immediately ✅
5. Approval queue works → ✅ Success!
```

---

## 📝 Next Steps

1. ✅ Run `employee_auto_user_creation.sql` script
2. ✅ Choose implementation option (Option 1 recommended)
3. ✅ Update frontend to show generated credentials
4. ✅ Test the complete flow
5. ✅ (Optional) Add email notification for credentials
6. ✅ (Optional) Add "Change Password" functionality

---

## ❓ FAQ

**Q: What if employee email already exists in user_profile?**  
A: The stored procedure checks and returns error: "User ID already exists"

**Q: Can I disable auto user creation for some employees?**  
A: Yes! Set `CreateUser: false` in the request body

**Q: Can employee change their password?**  
A: Yes! Use the existing `/api/auth/change-password` endpoint

**Q: What if I want different password format?**  
A: Modify the `fn_GenerateDefaultPassword` function in the SQL script

**Q: How do I send credentials via email?**  
A: Use the `mailer.js` utility in your backend after user creation

---

## 🎉 You're All Set!

Now test it by creating a new employee and check if you can login with the generated credentials!
