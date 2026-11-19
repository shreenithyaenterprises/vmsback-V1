import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { sendMail } from '../../utils/mailer.js';
import { buildRequestCreateXml, buildTemplateGetXml, buildFormLink } from './prebooking.utils.js';


const applyTemplate = (template, data) => {
	const replaceToken = (value, key) =>
		String(value).replace(new RegExp(`{{\\s*${key}\\s*}}`, 'gi'), data[key] ?? '');

	return Object.keys(data).reduce((acc, key) => replaceToken(acc, key), template);
};
export const createPrebookingRequest = async (req, res, next) => {
	try {
		logger.info('createPrebookingRequest API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingVisitorNameRule,
			RequiredRules.PrebookingVisitorEmailRule,
			RequiredRules.PrebookingDepartmentIdRule,
			RequiredRules.PrebookingVisitDateRule,
		]);
		if (errorResponse) return;

		const { VisitorName, VisitorEmail, HostEmployeeId, DepartmentId, VisitDate } = req.body;
		const xmlData = buildRequestCreateXml({
			VisitorName,
			VisitorEmail,
			HostEmployeeId,
			DepartmentId,
			VisitDate,
		});

		const result = await executeProcedureXml(
			'Prebooking_Request_Create_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating prebooking request: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating prebooking request: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const templateResult = await executeProcedureXml(
			'Prebooking_Template_Get_SP',
			'main',
			buildTemplateGetXml({ TemplateCode: 'PREBOOKING_REQUEST' })
		);
		if (!templateResult.success) {
			if (templateResult.errorType === 'E') {
				logger.error(`Template not found: ${templateResult?.error}`);
				return next(createError(STATUS_CODES.NOT_FOUND, templateResult?.error));
			}
			logger.error(`Stored procedure failed fetching template: ${templateResult?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const templateItem = Array.isArray(templateResult?.data?.Items)
			? templateResult.data.Items[0]
			: templateResult?.data?.Items;

		if (!templateItem?.Subject || !templateItem?.BodyHtml) {
			logger.error('Template payload missing Subject or BodyHtml');
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const token = result?.data?.Token;
		const formLink = token ? buildFormLink(req, token) : '';
		const templateData = {
			visitor_name: VisitorName,
			form_link: formLink,
		};
		const subject = applyTemplate(templateItem.Subject, templateData);
		const html = applyTemplate(templateItem.BodyHtml, templateData);

		try {
			await sendMail({
				to: VisitorEmail,
				subject,
				html,
			});
		} catch (mailError) {
			logger.error(
				`Mail send failed: ${mailError.message}; code=${mailError.code || 'NA'}; response=${mailError.response || 'NA'}; command=${mailError.command || 'NA'}; address=${mailError.address || 'NA'}; port=${mailError.port || 'NA'}`
			);
			return next(createError(STATUS_CODES.SERVER_ERROR, 'Unable to send email'));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Prebooking request created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating prebooking request: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
