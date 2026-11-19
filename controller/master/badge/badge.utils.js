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

const buildCreateXml = ({ Code, Color }) =>
	`<Badge><Code>${escapeXml(Code)}</Code><Color>${escapeXml(Color)}</Color></Badge>`;

const buildUpdateXml = ({ BadgeId, Code, Color }) =>
	`<Badge><BadgeId>${escapeXml(BadgeId)}</BadgeId><Code>${escapeXml(
		Code
	)}</Code><Color>${escapeXml(Color)}</Color></Badge>`;

const buildDeleteXml = ({ BadgeId }) =>
	`<Badge><BadgeId>${escapeXml(BadgeId)}</BadgeId></Badge>`;

const buildGetXml = ({ BadgeId } = {}) =>
	BadgeId
		? `<Badge><BadgeId>${escapeXml(BadgeId)}</BadgeId></Badge>`
		: '<Badge></Badge>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
