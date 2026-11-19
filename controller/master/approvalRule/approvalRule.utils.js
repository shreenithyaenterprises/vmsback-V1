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

const buildCreateXml = ({ VisitorTypeCode, ApprovalStatus }) =>
	`<ApprovalRule><VisitorTypeCode>${escapeXml(
		VisitorTypeCode
	)}</VisitorTypeCode><ApprovalStatus>${escapeXml(
		ApprovalStatus
	)}</ApprovalStatus></ApprovalRule>`;

const buildUpdateXml = ({ RuleId, VisitorTypeCode, ApprovalStatus }) =>
	`<ApprovalRule><RuleId>${escapeXml(
		RuleId
	)}</RuleId><VisitorTypeCode>${escapeXml(
		VisitorTypeCode
	)}</VisitorTypeCode><ApprovalStatus>${escapeXml(
		ApprovalStatus
	)}</ApprovalStatus></ApprovalRule>`;

const buildDeleteXml = ({ RuleId }) =>
	`<ApprovalRule><RuleId>${escapeXml(RuleId)}</RuleId></ApprovalRule>`;

const buildGetXml = ({ RuleId } = {}) =>
	RuleId
		? `<ApprovalRule><RuleId>${escapeXml(RuleId)}</RuleId></ApprovalRule>`
		: '<ApprovalRule></ApprovalRule>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
