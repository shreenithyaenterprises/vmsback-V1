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

const buildCreateXml = ({ Name }) =>
	`<Department><Name>${escapeXml(Name)}</Name></Department>`;

const buildUpdateXml = ({ DepartmentId, Name }) =>
	`<Department><DepartmentId>${escapeXml(
		DepartmentId
	)}</DepartmentId><Name>${escapeXml(Name)}</Name></Department>`;

const buildDeleteXml = ({ DepartmentId }) =>
	`<Department><DepartmentId>${escapeXml(DepartmentId)}</DepartmentId></Department>`;

const buildGetXml = ({ DepartmentId } = {}) =>
	DepartmentId
		? `<Department><DepartmentId>${escapeXml(
			DepartmentId
		)}</DepartmentId></Department>`
		: '<Department></Department>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
