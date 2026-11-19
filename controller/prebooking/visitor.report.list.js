import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildVisitorReportListXml } from './prebooking.utils.js';

const parseItems = (data) => {
	if (Array.isArray(data?.Items)) return data.Items;
	if (typeof data?.Items === 'string') {
		try {
			const parsed = JSON.parse(data.Items);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
};

export const listVisitorReport = async (req, res, next) => {
	try {
		logger.info('listVisitorReport API called');

		const {
			FromDate,
			ToDate,
			Search,
			PurposeId,
			VisitorType,
			VisitStatus,
			ApprovalStatus,
			PageNumber,
			PageSize,
		} = req.body || {};

		const xmlData = buildVisitorReportListXml({
			FromDate,
			ToDate,
			Search,
			PurposeId,
			VisitorType,
			VisitStatus,
			ApprovalStatus,
			PageNumber,
			PageSize,
		});

		const result = await executeProcedureXml('Visitor_Report_List_SP', 'main', xmlData);
		if (!result.success) {
			logger.error(`Stored procedure failed listing visitor report: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		const data = result?.data || {};
		const items = parseItems(data);

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: data?.Message || 'Visitor report fetched',
			data: {
				items,
				totalRecords: Number(data?.TotalRecords || 0),
				pageNumber: Number(data?.PageNumber || 1),
				pageSize: Number(data?.PageSize || 10),
				totalPages: Number(data?.TotalPages || 0),
			},
		});
	} catch (error) {
		logger.error(`There was an error during listing visitor report: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
