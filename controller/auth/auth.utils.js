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

const buildLoginXml = ({ UserId, Password }) =>
	`<Login><UserId>${escapeXml(UserId)}</UserId><Password>${escapeXml(
		Password
	)}</Password></Login>`;

const buildChangePasswordXml = ({ UserId, OldPassword, NewPassword }) =>
	`<ChangePassword><UserId>${escapeXml(UserId)}</UserId><OldPassword>${escapeXml(
		OldPassword
	)}</OldPassword><NewPassword>${escapeXml(NewPassword)}</NewPassword></ChangePassword>`;

export { escapeXml, buildLoginXml, buildChangePasswordXml };
