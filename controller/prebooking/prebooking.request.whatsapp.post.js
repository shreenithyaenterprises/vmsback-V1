import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
	getDatabaseByTarget,
	sql,
} from '../../utils/imports.js';
import { buildRequestCreateXml, buildFormLink } from './prebooking.utils.js';
import { normalizeWhatsAppNumber, sendPrebookingWhatsAppMessage } from '../../utils/whatsapp.js';

const MOBILE_REGEX = /^\d{10,15}$/;

const toISODate = (date = new Date()) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const resolveDepartmentId = async (inputDepartmentId) => {
	const sourceDepartmentId = inputDepartmentId ?? process.env.PREBOOKING_DEFAULT_DEPARTMENT_ID;
	const departmentId = Number(sourceDepartmentId);

	if (Number.isInteger(departmentId) && departmentId > 0) {
		return departmentId;
	}

	const pool = await getDatabaseByTarget('main');
	if (!pool) return null;

	const fallbackDepartment = await pool.request().query(`
		SELECT TOP 1 department_id AS DepartmentId
		FROM dbo.department_master
		WHERE ISNULL(is_active, 1) = 1
		ORDER BY department_id ASC
	`);

	const fallbackDepartmentId = Number(fallbackDepartment?.recordset?.[0]?.DepartmentId);
	return Number.isInteger(fallbackDepartmentId) && fallbackDepartmentId > 0
		? fallbackDepartmentId
		: null;
};

const resolveCompanyName = async (inputCompanyName) => {
	const trimmedCompanyName = String(inputCompanyName || '').trim();
	if (trimmedCompanyName) {
		return trimmedCompanyName;
	}

	const envCompanyName = String(
		process.env.WHATSAPP_COMPANY_NAME || process.env.SMTP_FROM_NAME || ''
	).trim();
	if (envCompanyName) {
		return envCompanyName;
	}

	const pool = await getDatabaseByTarget('main');
	if (!pool) return 'VMS';

	const companyConfig = await pool.request().query(`
		SELECT TOP 1 company_name AS CompanyName
		FROM dbo.company_config
		WHERE ISNULL(company_name, '') <> ''
		ORDER BY id ASC
	`);

	return String(companyConfig?.recordset?.[0]?.CompanyName || 'VMS').trim() || 'VMS';
};

const toValidNumericId = (value) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveHostEmployeeId = async ({ hostEmployeeId, departmentId }) => {
	const directHostId = toValidNumericId(hostEmployeeId);
	if (directHostId) return directHostId;

	const envHostId = toValidNumericId(process.env.PREBOOKING_DEFAULT_HOST_EMPLOYEE_ID);
	if (envHostId) return envHostId;

	const pool = await getDatabaseByTarget('main');
	if (!pool) return null;

	const request = pool.request();
	request.input('DepartmentId', sql.Int, departmentId);

	const byDepartment = await request.query(`
		SELECT TOP 1 employee_id AS EmployeeId
		FROM dbo.employee_master
		WHERE ISNULL(is_active, 1) = 1
		  AND department_id = @DepartmentId
		ORDER BY employee_id ASC
	`);

	const departmentHostId = toValidNumericId(byDepartment?.recordset?.[0]?.EmployeeId);
	if (departmentHostId) return departmentHostId;

	return null;
};

const buildFallbackEmail = (normalizedMobile) =>
	`wa.${normalizedMobile}.${Date.now()}@noemail.local`;

export const createPrebookingWhatsAppRequest = async (req, res, next) => {
	try {
		logger.info('createPrebookingWhatsAppRequest API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingVisitorNameRule,
			RequiredRules.PrebookingVisitorMobileRule,
		]);
		if (errorResponse) return;

		const {
			CompanyName,
			VisitorName,
			VisitorMobile,
			DepartmentId,
			HostEmployeeId,
			VisitDate,
		} = req.body;

		const resolvedCompanyName = await resolveCompanyName(CompanyName);

		const normalizedMobile = normalizeWhatsAppNumber(
			VisitorMobile,
			process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || ''
		);

		if (!MOBILE_REGEX.test(normalizedMobile)) {
			return next(
				createError(
					STATUS_CODES.BAD_REQUEST,
					'Please provide a valid mobile number with 10 to 15 digits.'
				)
			);
		}

		const resolvedDepartmentId = await resolveDepartmentId(DepartmentId);
		if (!resolvedDepartmentId) {
			return next(
				createError(
					STATUS_CODES.BAD_REQUEST,
					'Missing valid DepartmentId and no active department could be found in the database.'
				)
			);
		}

		const resolvedHostEmployeeId = await resolveHostEmployeeId({
			hostEmployeeId: HostEmployeeId,
			departmentId: resolvedDepartmentId,
		});

		const resolvedVisitDate = VisitDate || toISODate();
		const generatedEmail = buildFallbackEmail(normalizedMobile);

		const xmlData = buildRequestCreateXml({
			VisitorName,
			VisitorEmail: generatedEmail,
			HostEmployeeId: resolvedHostEmployeeId || HostEmployeeId,
			DepartmentId: resolvedDepartmentId,
			VisitDate: resolvedVisitDate,
		});

		const createResult = await executeProcedureXml(
			'Prebooking_Request_Create_SP',
			'main',
			xmlData
		);

		if (!createResult.success) {
			if (createResult.errorType === 'E') {
				logger.error(`Error creating WhatsApp prebooking request: ${createResult?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, createResult?.error));
			}

			logger.error(
				`Stored procedure failed creating WhatsApp prebooking request: ${createResult?.error}`
			);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const token = createResult?.data?.Token || '';
		if (!token) {
			logger.error('Prebooking request created but token is missing in response');
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					'Unable to create a form link because token is missing.'
				)
			);
		}

		const formLink = buildFormLink(req, token);
		if (!formLink) {
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					'Unable to build form link. Set PREBOOKING_FORM_BASE_URL or FRONTEND_URL.'
				)
			);
		}

		let whatsappResult;
		try {
			whatsappResult = await sendPrebookingWhatsAppMessage({
				to: normalizedMobile,
				companyName: resolvedCompanyName,
				visitorName: VisitorName,
				formLink,
			});
		} catch (whatsappError) {
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					`Unable to send WhatsApp message: ${whatsappError.message}`
				)
			);
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: createResult?.data?.Message || 'Prebooking request created and sent via WhatsApp',
			data: {
				...createResult?.data,
				VisitorMobile: normalizedMobile,
				CompanyName: resolvedCompanyName,
				FormLink: formLink,
				WhatsAppMessageId: whatsappResult?.messageId || null,
			},
		});
	} catch (error) {
		logger.error(`There was an error during WhatsApp prebooking request creation: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
