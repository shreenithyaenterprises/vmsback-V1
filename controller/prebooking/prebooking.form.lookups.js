import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../utils/imports.js';

const parseItems = (resultData) => {
	const items = resultData?.Items;
	if (Array.isArray(items)) return items;
	if (typeof items === 'string') {
		try {
			const parsed = JSON.parse(items);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
};

export const getPublicFormLookups = async (_req, res, next) => {
	try {
		logger.info('getPublicFormLookups API called');

		const [idProofResult, purposeResult, employeeResult] = await Promise.all([
			executeProcedureXml('IdProof_Get_SP', 'main', '<IdProof></IdProof>'),
			executeProcedureXml('Purpose_Get_SP', 'main', '<Purpose></Purpose>'),
			executeProcedureXml('Employee_Get_SP', 'main', '<Employee></Employee>'),
		]);

		for (const lookupResult of [idProofResult, purposeResult, employeeResult]) {
			if (!lookupResult.success) {
				if (lookupResult.errorType === 'E') {
					logger.error(`Error fetching public lookups: ${lookupResult?.error}`);
					return next(createError(STATUS_CODES.CONFLICT, lookupResult?.error));
				}
				logger.error(`Stored procedure failed fetching public lookups: ${lookupResult?.error}`);
				return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
			}
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Public prebooking lookups fetched',
			data: {
				idProofs: parseItems(idProofResult?.data),
				purposes: parseItems(purposeResult?.data),
				employees: parseItems(employeeResult?.data),
			},
		});
	} catch (error) {
		logger.error(`There was an error during fetching public lookups: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};