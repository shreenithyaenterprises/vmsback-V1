import cors from 'cors';
import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import sql from 'mssql';

import logger from '../middlewares/logger.js';
import { getDatabaseByTarget } from '../config/database.js';
import createError from '../error.js';
import executeProcedureXml from './executeProcedureXml.js';
import { validateRequest } from './validateRequest.js';
import { STATUS_CODES, STATUS_MESSAGES, VALIDATIONS } from '../constants/constants.js';
import { RequiredRules } from '../validationRules/RequiredRules.js';

export {
	cors,
	express,
	body,
	validationResult,
	jwt,
	sql,
	logger,
	getDatabaseByTarget,
	createError,
	executeProcedureXml,
	validateRequest,
	STATUS_CODES,
	STATUS_MESSAGES,
	VALIDATIONS,
	RequiredRules,
};
