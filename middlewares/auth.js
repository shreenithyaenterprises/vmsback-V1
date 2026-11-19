import { STATUS_CODES, STATUS_MESSAGES, createError, logger } from '../utils/imports.js';
import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header
 * Extracts user info and attaches to req.user
 */
export const authenticateToken = (req, res, next) => {
	try {
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

		if (!token) {
			logger.warn('No token provided in request');
			return next(
				createError(STATUS_CODES.UNAUTHORIZED, 'Token not provided')
			);
		}

		const secret = process.env.TOKEN_SECRET_KEY;

		if (!secret) {
			logger.error('TOKEN_SECRET_KEY is not configured');
			return next(
				createError(STATUS_CODES.SERVER_ERROR, 'Server configuration error')
			);
		}

		jwt.verify(token, secret, (err, user) => {
			if (err) {
				logger.warn(`Token verification failed: ${err.message}`);
				return next(
					createError(STATUS_CODES.UNAUTHORIZED, 'Invalid or expired token')
				);
			}

			// Attach user info to request
			// Token payload has userId and role
			req.user = {
				id: user.userId,
				userId: user.userId,
				role: user.role,
			};
			logger.info(`User authenticated: ${user.userId}`);
			next();
		});
	} catch (error) {
		logger.error(`Auth middleware error: ${error}`);
		return next(
			createError(STATUS_CODES.UNAUTHORIZED, STATUS_MESSAGES.UNAUTHORIZED)
		);
	}
};

export default authenticateToken;
