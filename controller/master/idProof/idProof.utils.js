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
	`<IdProof><Name>${escapeXml(Name)}</Name></IdProof>`;

const buildUpdateXml = ({ IdProofId, Name }) =>
	`<IdProof><IdProofId>${escapeXml(IdProofId)}</IdProofId><Name>${escapeXml(
		Name
	)}</Name></IdProof>`;

const buildDeleteXml = ({ IdProofId }) =>
	`<IdProof><IdProofId>${escapeXml(IdProofId)}</IdProofId></IdProof>`;

const buildGetXml = ({ IdProofId } = {}) =>
	IdProofId
		? `<IdProof><IdProofId>${escapeXml(IdProofId)}</IdProofId></IdProof>`
		: '<IdProof></IdProof>';

export { buildCreateXml, buildUpdateXml, buildDeleteXml, buildGetXml };
