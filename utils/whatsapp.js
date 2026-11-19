import axios from 'axios';
import logger from '../middlewares/logger.js';

const DEFAULT_GRAPH_API_VERSION = 'v22.0';
const WHATSAPP_BASE_URL = 'https://graph.facebook.com';
const DEFAULT_SPARKLE_BASE_URL = 'https://sparklebot.in/api/v1';

const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

export const normalizeWhatsAppNumber = (mobile, defaultCountryCode = '') => {
	const cleanedMobile = digitsOnly(mobile);
	const cleanedCountryCode = digitsOnly(defaultCountryCode);

	if (!cleanedMobile) return '';

	if (cleanedMobile.length === 10 && cleanedCountryCode) {
		return `${cleanedCountryCode}${cleanedMobile}`;
	}

	return cleanedMobile;
};

const resolveWhatsAppConfig = () => {
	const provider = (process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();

	const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
	const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
	const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION;
	const templateName = process.env.WHATSAPP_TEMPLATE_NAME || '';
	const templateLanguageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';

	const sparkleBaseUrl =
		(process.env.WHATSAPP_SPARKLE_BASE_URL || DEFAULT_SPARKLE_BASE_URL).replace(/\/+$/, '');
	const sparkleSender = process.env.WHATSAPP_SPARKLE_SENDER || 'wwwsnithyacom';
	const sparkleToken = process.env.WHATSAPP_SPARKLE_TOKEN || '';
	const sparkleTemplateName =
		process.env.WHATSAPP_SPARKLE_TEMPLATE_NAME || templateName || 'dailyvisitor';
	const sparkleTemplateLanguage =
		process.env.WHATSAPP_SPARKLE_TEMPLATE_LANGUAGE || templateLanguageCode || 'en';

	return {
		provider,
		accessToken,
		phoneNumberId,
		apiVersion,
		templateName,
		templateLanguageCode,
		sparkleBaseUrl,
		sparkleSender,
		sparkleToken,
		sparkleTemplateName,
		sparkleTemplateLanguage,
	};
};

export const buildWhatsAppMessageBody = ({
	companyName,
	visitorName,
	formLink,
	signatureName,
}) => {
	const safeCompanyName = String(companyName || 'Our team').trim() || 'Our team';
	const safeVisitorName = String(visitorName || 'there').trim() || 'there';
	const safeSignatureName = String(signatureName || '').trim();
	const signatureLine = safeSignatureName ? `\n\nRegards,\n${safeSignatureName}` : '';

	return `${safeCompanyName} has sent you a prebooking form. Hello ${safeVisitorName}, please open the form here: ${formLink}${signatureLine}`;
};

export const buildApprovalWhatsAppMessageBody = ({
  companyName,
  visitorName,
  visitorEmail,
  approveLink,
  rejectLink,
  signatureName,
}) => {
  const safeCompanyName = String(companyName || 'VMS').trim() || 'VMS';
  const safeVisitorName = String(visitorName || 'Visitor').trim() || 'Visitor';
  const safeVisitorEmail = String(visitorEmail || '').trim();
  const safeSignatureName = String(signatureName || '').trim();

  const signatureLine = safeSignatureName
    ? `\n\nRegards,\n${safeSignatureName}`
    : '';

  const emailLine = safeVisitorEmail
    ? `Email: ${safeVisitorEmail}`
    : '';

  // Build the message with clear blank lines between sections
  return (
    `Dear Sir/Madam,\n\n` +
    `A visitor pre-booking request has been initiated by ${safeCompanyName}.\n\n` +
    `Visitor Name: ${safeVisitorName}\n` +
    (emailLine ? `${emailLine}\n\n` : '\n') +
    `Kindly complete the required details using the link below:\n\n` +
    `${safeCompanyName} prebooking approval required.\n` +
    `Visitor: ${safeVisitorName}\n` +
    (emailLine ? `${emailLine}\n\n` : '\n') +
    `Approve Link:\n${approveLink}\n\n` +
    `Reject Link:\n${rejectLink}` +
    signatureLine
  );
};

const buildTemplatePayload = ({
	to,
	templateName,
	templateLanguageCode,
	companyName,
	visitorName,
	formLink,
	signatureName,
}) => ({
	messaging_product: 'whatsapp',
	to,
	type: 'template',
	template: {
		name: templateName,
		language: {
			code: templateLanguageCode,
		},
		components: [
			{
				type: 'body',
				parameters: [
					{ type: 'text', text: companyName },
					{ type: 'text', text: visitorName },
					{ type: 'text', text: buildWhatsAppMessageBody({ companyName, visitorName, formLink, signatureName }) },
					{ type: 'text', text: signatureName },
				],
			},
		],
	},
});

const sendViaSparklebot = async ({
	to,
	companyName,
	visitorName,
	formLink,
	signatureName,
	bodyText,
	sparkleBaseUrl,
	sparkleSender,
	sparkleToken,
	sparkleTemplateName,
	sparkleTemplateLanguage,
}) => {
	if (!sparkleToken) {
		throw new Error('Missing Sparklebot token. Set WHATSAPP_SPARKLE_TOKEN.');
	}

	const endpoint = `${sparkleBaseUrl}/${sparkleSender}/messages/template`;
	const resolvedBodyText =
		bodyText || buildWhatsAppMessageBody({ companyName, visitorName, formLink, signatureName });
	const payloadVariants = [
		{
			phone_number: to,
			template_name: sparkleTemplateName,
			template_language: sparkleTemplateLanguage,
			field_1: companyName,
			field_2: visitorName,
			field_3: resolvedBodyText,
			field_4: signatureName,
		},
		{
			phone_number: to,
			template_name: sparkleTemplateName,
			template_language: sparkleTemplateLanguage,
			field_1: visitorName,
			field_2: resolvedBodyText,
			field_3: companyName,
			field_4: signatureName,
		},
	];

	let lastError;
	try {
		for (const payload of payloadVariants) {
			try {
				const response = await axios.postForm(endpoint, payload, {
					headers: {
						Authorization: `Bearer ${sparkleToken}`,
					},
					timeout: 10000,
				});

				const messageId =
					response?.data?.data?.message_id ||
					response?.data?.message_id ||
					response?.data?.id ||
					null;

				return {
					messageId,
					providerResponse: response?.data || {},
				};
			} catch (error) {
				lastError = error;
				const providerMessage =
					error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unknown Sparklebot error';

				if (!/validation failed/i.test(String(providerMessage))) {
					throw error;
				}
			}
		}

		throw lastError || new Error('Unknown Sparklebot error');
	} catch (error) {
		const providerMessage =
			error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unknown Sparklebot error';

		logger.error(`Sparklebot WhatsApp send failed: ${providerMessage}`);
		throw new Error(providerMessage);
	}
};

export const sendPrebookingWhatsAppMessage = async ({
	to,
	companyName,
	visitorName,
	formLink,
	bodyText,
	signatureName = process.env.WHATSAPP_SIGNATURE_NAME || process.env.SMTP_FROM_NAME || companyName,
}) => {
	const {
		provider,
		accessToken,
		phoneNumberId,
		apiVersion,
		templateName,
		templateLanguageCode,
		sparkleBaseUrl,
		sparkleSender,
		sparkleToken,
		sparkleTemplateName,
		sparkleTemplateLanguage,
	} =
		resolveWhatsAppConfig();

	if (provider === 'sparklebot' || sparkleToken) {
		return sendViaSparklebot({
			to,
			companyName,
			visitorName,
			formLink,
			bodyText,
			signatureName,
			sparkleBaseUrl,
			sparkleSender,
			sparkleToken,
			sparkleTemplateName,
			sparkleTemplateLanguage,
		});
	}

	if (!accessToken || !phoneNumberId) {
		throw new Error(
			'Missing WhatsApp configuration. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.'
		);
	}

	if (!templateName) {
		throw new Error('Missing WhatsApp template configuration. Set WHATSAPP_TEMPLATE_NAME.');
	}

	const payload = buildTemplatePayload({
		to,
		templateName,
		templateLanguageCode,
		companyName,
		visitorName,
		formLink,
		signatureName,
	});

	const endpoint = `${WHATSAPP_BASE_URL}/${apiVersion}/${phoneNumberId}/messages`;

	try {
		const response = await axios.post(endpoint, payload, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			timeout: 10000,
		});

		const messageId = response?.data?.messages?.[0]?.id || null;

		if (!messageId) {
			logger.error(`Unexpected WhatsApp API response: ${JSON.stringify(response?.data || {})}`);
			throw new Error('WhatsApp API response did not include message id.');
		}

		return {
			messageId,
			providerResponse: response.data,
		};
	} catch (error) {
		const providerMessage =
			error?.response?.data?.error?.message ||
			error?.response?.data?.message ||
			error?.message ||
			'Unknown WhatsApp provider error';

		logger.error(`WhatsApp send failed: ${providerMessage}`);
		throw new Error(providerMessage);
	}
};
