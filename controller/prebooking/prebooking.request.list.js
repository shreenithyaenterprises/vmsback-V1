import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildRequestListXml } from './prebooking.utils.js';

export const listPrebookingRequests = async (req, res, next) => {
	try {
		logger.info('listPrebookingRequests API called');

		const { Status, FromDate, ToDate } = req.body || {};
		const xmlData = buildRequestListXml({ Status, FromDate, ToDate });

		const result = await executeProcedureXml('Prebooking_Request_List_SP', 'main', xmlData);
		if (!result.success) {
			logger.error(`Stored procedure failed listing prebooking requests: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Prebooking requests fetched',
			items: result?.data?.Items || [],
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during listing prebooking requests: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
