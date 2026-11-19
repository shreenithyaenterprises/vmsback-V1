export const STATUS_CODES = {
	OK: 200,
	BAD_REQUEST: 400,
	SERVER_ERROR: 500,
	CREATED: 201,
	REQ_DATING_ERROR_CODE: 204,
	UNAUTHORIZED: 401,
	FORBIDDEN_CODE: 403,
	INACTIVATE: 406,
	NOT_FOUND: 404,
	CONFLICT: 409,
};

export const STATUS_MESSAGES = {
	REQUIRED_DETAILS: 'Please fill all the necessary details!',
	UNAUTHORIZED_REQUEST: 'You are not authorized to perform this request!',
	SERVER_ERROR: 'Something went wrong',
	FETCHED_SUCCESSFULLY: 'Fetched Successfully',
	ADDED_SUCCESSFULLY: 'Added Successfully',
	UPDATED_SUCCESSFULLY: 'Updated Successfully',
	INVALID_PAGE_NO: 'Requested page exceeds total available pages',
	INVALID_ID: 'Please provide a valid id',
	ALREADY_EXIST: 'Already Exist',
	DELETED_SUCCESSFULLY: 'Deleted Successfully',
	NO_MATCHING_RESULT_FOUND: 'No Data found',
	NO_MATCHING_RESULT_FOUND_Id: 'No Data found with provided Id',
	VERIFICATION_CODE_SENT: 'Verification Code Successfully Sent',
	OTP_VERIFIED: 'OTP Verified Successfully',
	OTP_EXPIRED: 'The OTP has been Expired',
	INVALID_BOOLEAN: 'Please Provide a valid value for toggling value',
	INVALID_DATE: 'Please Provide a valid values for date',
};

export const VALIDATIONS = {
	TOKEN_EXPIRY_TIME: '15d',
	PHONE_REGEX_VALIDATION: /^[0-9]{10}$/,
	EMAIL_REGEX_VALIDATION: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
	// One uppercase one loswe case a digit and two special character
	PASSWORD_REGEX_VALIDATION:
		/^(?=(.*[a-z]))(?=(.*[A-Z]))(?=(.*\d))(?=(.*[@#$%^&+=!].*[@#$%^&+=!]))[A-Za-z\d@$!%*?&]{8,}$/,
};
