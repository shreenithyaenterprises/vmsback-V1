import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';

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

const buildCreateXml = ({ userDepartment, officialType, purposeOfVisit, createdBy }) =>
	`<GovernmentOfficial><UserDepartment>${escapeXml(
		userDepartment
	)}</UserDepartment><OfficialType>${escapeXml(
		officialType
	)}</OfficialType><PurposeOfVisit>${escapeXml(
		purposeOfVisit
	)}</PurposeOfVisit><CreatedBy>${escapeXml(createdBy ?? '')}</CreatedBy></GovernmentOfficial>`;

const buildListXml = ({ forDate }) => {
	if (!forDate) {
		return '<GovernmentOfficial></GovernmentOfficial>';
	}

	return `<GovernmentOfficial><ForDate>${escapeXml(forDate)}</ForDate></GovernmentOfficial>`;
};

const buildStatusSyncXml = ({ visitID, visitStatus, updatedBy }) =>
	`<GovernmentOfficial><VisitID>${escapeXml(visitID)}</VisitID><VisitStatus>${escapeXml(
		visitStatus
	)}</VisitStatus><UpdatedBy>${escapeXml(updatedBy ?? '')}</UpdatedBy></GovernmentOfficial>`;

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

const resolveNumericUserId = (req) => {
	const raw = req.user?.userId ?? req.user?.id;
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export const createGovernmentOfficialEntry = async (req, res, next) => {
	try {
		logger.info('createGovernmentOfficialEntry API called');

		const { UserDepartment, OfficialType, PurposeOfVisit } = req.body || {};
		if (!UserDepartment || !OfficialType || !PurposeOfVisit) {
			return next(
				createError(
					STATUS_CODES.BAD_REQUEST,
					'UserDepartment, OfficialType, and PurposeOfVisit are required.'
				)
			);
		}

		const createdBy = req.user?.userId || req.user?.id || null;
		const xmlData = buildCreateXml({
			userDepartment: UserDepartment,
			officialType: OfficialType,
			purposeOfVisit: PurposeOfVisit,
			createdBy,
		});

		const result = await executeProcedureXml('GovernmentOfficial_Create_SP', 'main', xmlData);
		if (!result.success) {
			logger.error(`Error creating government official entry: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Government official entry created.',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during government official creation: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const listGovernmentOfficialEntriesToday = async (req, res, next) => {
	try {
		logger.info('listGovernmentOfficialEntriesToday API called');

		const { ForDate } = req.body || {};
		const xmlData = buildListXml({ forDate: ForDate || null });
		const result = await executeProcedureXml('GovernmentOfficial_Today_List_SP', 'main', xmlData);

		if (!result.success) {
			logger.error(`Error fetching government official entries: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Government official entries fetched.',
			data: {
				forDate: result?.data?.ForDate || null,
				items: parseItems(result?.data),
			},
		});
	} catch (error) {
		logger.error(`There was an error during government official list: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const checkInGovernmentOfficial = async (req, res, next) => {
	try {
		logger.info('checkInGovernmentOfficial API called');

		const { VisitID, EntryGate } = req.body || {};
		if (!VisitID) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'VisitID is required'));
		}

		const verifiedBy = resolveNumericUserId(req);
		const checkInXml = `<CheckInRequest><VisitID>${escapeXml(
			VisitID
		)}</VisitID><PPEItems></PPEItems><EntryGate>${escapeXml(
			EntryGate || 'Main Gate'
		)}</EntryGate><VerifiedByEmployeeID>${escapeXml(verifiedBy)}</VerifiedByEmployeeID></CheckInRequest>`;

		const checkInResult = await executeProcedureXml('CheckInVisitor_SP', 'main', checkInXml);
		if (!checkInResult.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, checkInResult?.error || 'Unable to check in'));
		}

		const syncXml = buildStatusSyncXml({
			visitID: VisitID,
			visitStatus: 'CHECKED_IN',
			updatedBy: verifiedBy,
		});
		await executeProcedureXml('GovernmentOfficial_Status_Sync_SP', 'main', syncXml);

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: checkInResult?.data?.Message || 'Government official checked in successfully.',
			data: checkInResult?.data,
		});
	} catch (error) {
		logger.error(`There was an error during government official check-in: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const checkOutGovernmentOfficial = async (req, res, next) => {
	try {
		logger.info('checkOutGovernmentOfficial API called');

		const { VisitID, ExitGate } = req.body || {};
		if (!VisitID) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'VisitID is required'));
		}

		const updatedBy = resolveNumericUserId(req);
		const checkOutXml = `<CheckOutRequest><VisitID>${escapeXml(
			VisitID
		)}</VisitID><ExitGate>${escapeXml(ExitGate || 'Main Gate')}</ExitGate><PPEItems></PPEItems></CheckOutRequest>`;

		const checkOutResult = await executeProcedureXml('CheckOutVisitor_SP', 'main', checkOutXml);
		if (!checkOutResult.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, checkOutResult?.error || 'Unable to check out'));
		}

		const syncXml = buildStatusSyncXml({
			visitID: VisitID,
			visitStatus: 'CHECKED_OUT',
			updatedBy,
		});
		await executeProcedureXml('GovernmentOfficial_Status_Sync_SP', 'main', syncXml);

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: checkOutResult?.data?.Message || 'Government official checked out successfully.',
			data: checkOutResult?.data,
		});
	} catch (error) {
		logger.error(`There was an error during government official check-out: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
