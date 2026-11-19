import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildHomeDashboardXml } from './prebooking.utils.js';

const parseArray = (value) => {
	if (Array.isArray(value)) return value;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
};

export const getHomeDashboardSummary = async (req, res, next) => {
	try {
		logger.info('getHomeDashboardSummary API called');

		const { ForDate } = req.body || {};
		const xmlData = buildHomeDashboardXml({ ForDate });

		const result = await executeProcedureXml('Home_Dashboard_Summary_SP', 'main', xmlData);
		if (!result.success) {
			logger.error(`Stored procedure failed loading home dashboard: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		const data = result?.data || {};

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: data?.Message || 'Home dashboard fetched',
			data: {
				forDate: data?.ForDate || null,
				todayTotalVisitors: Number(data?.TodayTotalVisitors || 0),
				todayPrebookingVisitors: Number(data?.TodayPrebookingVisitors || 0),
				todayVIPVisitors: Number(data?.TodayVIPVisitors || 0),
				departmentWise: parseArray(data?.DepartmentWise),
				todayVisitors: parseArray(data?.TodayVisitors),
				upcomingVisitors: parseArray(data?.UpcomingVisitors),
				vipVisitors: parseArray(data?.VIPVisitors),
			},
		});
	} catch (error) {
		logger.error(`There was an error during loading home dashboard: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
