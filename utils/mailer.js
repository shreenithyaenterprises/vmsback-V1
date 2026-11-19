import { lookup } from 'dns/promises';
import nodemailer from 'nodemailer';

const resolveBool = (value) => String(value).toLowerCase() === 'true';
const resolveNumber = (value, fallback) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const getMailConfig = () => ({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT || 587),
	secure: resolveBool(process.env.SMTP_SECURE),
	requireTLS: resolveBool(process.env.SMTP_REQUIRE_TLS),
	family: resolveNumber(process.env.SMTP_FAMILY, undefined),
	connectionTimeout: resolveNumber(process.env.SMTP_CONNECTION_TIMEOUT, 30000),
	greetingTimeout: resolveNumber(process.env.SMTP_GREETING_TIMEOUT, 30000),
	socketTimeout: resolveNumber(process.env.SMTP_SOCKET_TIMEOUT, 60000),
	rejectUnauthorized:
		process.env.SMTP_TLS_REJECT_UNAUTHORIZED === undefined
			? true
			: resolveBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED),
	user: process.env.SMTP_USER,
	pass: process.env.SMTP_PASS,
	from: process.env.SMTP_FROM || process.env.SMTP_USER,
	fromName: process.env.SMTP_FROM_NAME || 'Premium VMS',
});

const isIpAddress = (value) => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(value || ''));

const resolveTransportHost = async ({ host, family }) => {
	if (!host || family !== 4 || isIpAddress(host)) {
		return { transportHost: host, servername: undefined };
	}

	const result = await lookup(host, { family: 4 });
	if (!result?.address) {
		throw new Error(`Unable to resolve IPv4 address for ${host}`);
	}

	return {
		transportHost: result.address,
		servername: host,
	};
};

const shouldRetryWithIPv4 = (error, host, family) => {
	if (family === 4) {
		return false;
	}

	if (!host || host.toLowerCase() !== 'smtp.gmail.com') {
		return false;
	}

	if (!['ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENETUNREACH'].includes(error?.code)) {
		return false;
	}

	return String(error?.address || '').includes(':');
};

const shouldRetryWithImplicitTls = (error, port, secure) =>
	!secure &&
	Number(port) === 587 &&
	['ETIMEDOUT', 'ESOCKET'].includes(error?.code) &&
	/Greeting never received/i.test(String(error?.message || ''));

const createTransporter = async (overrides = {}) => {
	const {
		host,
		port,
		secure,
		requireTLS,
		family,
		user,
		pass,
		connectionTimeout,
		greetingTimeout,
		socketTimeout,
	} = {
		...getMailConfig(),
		...overrides,
	};
	const { rejectUnauthorized } = getMailConfig();

	if (!host || !user || !pass) {
		throw new Error('SMTP configuration is missing');
	}

	const { transportHost, servername } = await resolveTransportHost({ host, family });

	const transporterOptions = {
		host: transportHost,
		port,
		secure,
		requireTLS,
		connectionTimeout,
		greetingTimeout,
		socketTimeout,
		auth: {
			user,
			pass,
		},
	};

	if (Number.isFinite(family)) {
		transporterOptions.family = family;
	}

	if (servername) {
		transporterOptions.tls = {
			servername,
			rejectUnauthorized,
		};
	} else {
		transporterOptions.tls = {
			rejectUnauthorized,
		};
	}

	return nodemailer.createTransport(transporterOptions);
};

const renderFrom = () => {
	const { from, fromName } = getMailConfig();
	return fromName ? `${fromName} <${from}>` : from;
};

const sendMail = async ({ to, subject, html, text, attachments }) => {
	const mailOptions = {
		from: renderFrom(),
		to,
		subject,
		html,
		text,
	};
	
	// Add attachments if provided
	if (attachments && attachments.length > 0) {
		mailOptions.attachments = attachments;
	}
	
	const { host, family } = getMailConfig();

	try {
		const transporter = await createTransporter();
		return await transporter.sendMail(mailOptions);
	} catch (error) {
		const { port, secure } = getMailConfig();

		if (shouldRetryWithImplicitTls(error, port, secure)) {
			const transporter = await createTransporter({
				port: 465,
				secure: true,
				requireTLS: false,
			});
			return transporter.sendMail(mailOptions);
		}

		if (!shouldRetryWithIPv4(error, host, family)) {
			throw error;
		}

		const transporter = await createTransporter({ family: 4 });
		return transporter.sendMail(mailOptions);
	}
};

export { sendMail };
