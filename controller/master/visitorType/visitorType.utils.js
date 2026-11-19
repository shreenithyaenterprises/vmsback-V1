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
	`<VisitorType><Code>${escapeXml(Code)}</Code><Name>${escapeXml(
		Name
	)}</Name></VisitorType>`;

const buildUpdateXml = ({ VisitorTypeId, Code, Name }) =>
	`<VisitorType><VisitorTypeId>${escapeXml(
		VisitorTypeId
	)}</VisitorTypeId><Code>${escapeXml(Code)}</Code><Name>${escapeXml(
		Name
	)}</Name></VisitorType>`;

const buildDeleteXml = ({ VisitorTypeId }) =>
	`<VisitorType><VisitorTypeId>${escapeXml(VisitorTypeId)}</VisitorTypeId></VisitorType>`;

const buildGetXml = ({ VisitorTypeId } = {}) =>
	VisitorTypeId
		? `<VisitorType><VisitorTypeId>${escapeXml(
				VisitorTypeId
		  )}</VisitorTypeId></VisitorType>`
		: '<VisitorType></VisitorType>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
