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
	`<Designation><Name>${escapeXml(Name)}</Name></Designation>`;

const buildUpdateXml = ({ DesignationId, Name }) =>
	`<Designation><DesignationId>${escapeXml(
		DesignationId
	)}</DesignationId><Name>${escapeXml(Name)}</Name></Designation>`;

const buildDeleteXml = ({ DesignationId }) =>
	`<Designation><DesignationId>${escapeXml(DesignationId)}</DesignationId></Designation>`;

const buildGetXml = ({ DesignationId } = {}) =>
	DesignationId
		? `<Designation><DesignationId>${escapeXml(
			DesignationId
		)}</DesignationId></Designation>`
		: '<Designation></Designation>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
