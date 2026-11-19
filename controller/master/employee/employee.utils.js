const escapeXml = (value = '') =>
	String(value).replace(/[<>&'\"]/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case "'":
				return '&apos;';
			case '"':
				return '&quot;';
			default:
				return ch;
		}
	});

const buildCreateXml = ({
	Name,
	Department,
	DepartmentId,
	Designation,
	Mobile,
	Email,
	IsDepartmentHead,
	ApprovalRequired,
	CreateUser = true,
}) =>
	`<Employee><Name>${escapeXml(Name)}</Name><Department>${escapeXml(
		Department
	)}</Department><DepartmentId>${escapeXml(
		DepartmentId
	)}</DepartmentId><Designation>${escapeXml(Designation)}</Designation><Mobile>${escapeXml(
		Mobile
	)}</Mobile><Email>${escapeXml(Email)}</Email><IsDepartmentHead>${escapeXml(
		IsDepartmentHead
	)}</IsDepartmentHead><ApprovalRequired>${escapeXml(
		ApprovalRequired
	)}</ApprovalRequired><CreateUser>${escapeXml(CreateUser)}</CreateUser></Employee>`;

const buildUpdateXml = ({
	EmployeeId,
	Name,
	Department,
	DepartmentId,
	Designation,
	Mobile,
	Email,
	IsDepartmentHead,
	ApprovalRequired,
}) =>
	`<Employee><EmployeeId>${escapeXml(
		EmployeeId
	)}</EmployeeId><Name>${escapeXml(Name)}</Name><Department>${escapeXml(
		Department
	)}</Department><DepartmentId>${escapeXml(
		DepartmentId
	)}</DepartmentId><Designation>${escapeXml(Designation)}</Designation><Mobile>${escapeXml(
		Mobile
	)}</Mobile><Email>${escapeXml(Email)}</Email><IsDepartmentHead>${escapeXml(
		IsDepartmentHead
	)}</IsDepartmentHead><ApprovalRequired>${escapeXml(
		ApprovalRequired
	)}</ApprovalRequired></Employee>`;

const buildDeleteXml = ({ EmployeeId }) =>
	`<Employee><EmployeeId>${escapeXml(EmployeeId)}</EmployeeId></Employee>`;

const buildGetXml = ({ EmployeeId } = {}) =>
	EmployeeId
		? `<Employee><EmployeeId>${escapeXml(EmployeeId)}</EmployeeId></Employee>`
		: '<Employee></Employee>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
