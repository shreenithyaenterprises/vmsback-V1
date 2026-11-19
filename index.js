import { getDatabaseByTarget } from './config/database.js';
import app from './app.js';

getDatabaseByTarget('main')
	.then(() => {
		console.log('Database connection established.'); // eslint-disable-line no-console
		console.log(
			`DB target: ${process.env.DB_HOST || process.env.DB_SERVER} | ${process.env.DB_NAME} | ${process.env.DB_USER}`
		); // eslint-disable-line no-console
		const portArg =
			process.argv.find((arg) => arg.startsWith('--port='))?.split('=')[1] ||
			(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : null);
		const PORT = Number(portArg || process.env.PORT) || 5002; //no-magic-number
		app.listen(PORT, '0.0.0.0', () => console.log(`Server Running On Port ${PORT}`)); // eslint-disable-line no-console
	})
	.catch((err) => {
		console.log('Error: ' + err); // eslint-disable-line no-console
	});
