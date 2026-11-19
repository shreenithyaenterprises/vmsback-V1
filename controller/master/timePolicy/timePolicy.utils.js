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

const buildCreateXml = ({ VisitorTypeCode, PolicyLabel }) =>
	`<TimePolicy><VisitorTypeCode>${escapeXml(
		VisitorTypeCode
	)}</VisitorTypeCode><PolicyLabel>${escapeXml(
		PolicyLabel
	)}</PolicyLabel></TimePolicy>`;

const buildUpdateXml = ({ PolicyId, VisitorTypeCode, PolicyLabel }) =>
	`<TimePolicy><PolicyId>${escapeXml(
		PolicyId
	)}</PolicyId><VisitorTypeCode>${escapeXml(
		VisitorTypeCode
	)}</VisitorTypeCode><PolicyLabel>${escapeXml(
		PolicyLabel
	)}</PolicyLabel></TimePolicy>`;

const buildDeleteXml = ({ PolicyId }) =>
	`<TimePolicy><PolicyId>${escapeXml(PolicyId)}</PolicyId></TimePolicy>`;

const buildGetXml = ({ PolicyId } = {}) =>
	PolicyId
		? `<TimePolicy><PolicyId>${escapeXml(PolicyId)}</PolicyId></TimePolicy>`
		: '<TimePolicy></TimePolicy>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
