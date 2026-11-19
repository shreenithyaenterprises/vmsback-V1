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

const buildCreateXml = ({ Code, Name }) =>
	`<Purpose><Code>${escapeXml(Code)}</Code><Name>${escapeXml(Name)}</Name></Purpose>`;

const buildUpdateXml = ({ PurposeId, Code, Name }) =>
	`<Purpose><PurposeId>${escapeXml(
		PurposeId
	)}</PurposeId><Code>${escapeXml(Code)}</Code><Name>${escapeXml(
		Name
	)}</Name></Purpose>`;

const buildDeleteXml = ({ PurposeId }) =>
	`<Purpose><PurposeId>${escapeXml(PurposeId)}</PurposeId></Purpose>`;

const buildGetXml = ({ PurposeId } = {}) =>
	PurposeId
		? `<Purpose><PurposeId>${escapeXml(PurposeId)}</PurposeId></Purpose>`
		: '<Purpose></Purpose>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
