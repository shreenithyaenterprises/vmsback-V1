import crypto from 'crypto';

const getApprovalLinkSecret = () =>
	process.env.APPROVAL_LINK_SECRET ||
	process.env.JWT_SECRET ||
	process.env.SMTP_PASS ||
	'premium-vms-approval-link-secret';

const createApprovalActionToken = (approvalLogId, action) =>
	crypto
		.createHmac('sha256', getApprovalLinkSecret())
		.update(`${approvalLogId}:${action}`)
		.digest('hex');

const isValidApprovalActionToken = (approvalLogId, action, token) => {
	if (!approvalLogId || !action || !token) return false;

	const expected = createApprovalActionToken(approvalLogId, action);
	const expectedBuffer = Buffer.from(expected, 'hex');
	const tokenBuffer = Buffer.from(String(token), 'hex');

	return (
		expectedBuffer.length === tokenBuffer.length &&
		crypto.timingSafeEqual(expectedBuffer, tokenBuffer)
	);
};

export { createApprovalActionToken, isValidApprovalActionToken };
