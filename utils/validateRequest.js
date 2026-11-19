import { validationResult, logger, STATUS_CODES } from './imports.js';

export const validateRequest = async (req, res, rules) => {
	for (const rule of rules) {
		await rule.run(req);
	}

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		logger.error(
			`Validation failed for ${errors.array()[0].path} (${errors.array()[0].value}): ${errors.array()[0].msg}.`
		);

		return res
			.status(STATUS_CODES.BAD_REQUEST)
			.json({ success: false, message: errors.array()[0].msg });
	}

	return null;
};
