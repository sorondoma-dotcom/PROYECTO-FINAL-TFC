function errorHandler(err, req, res, next) {
	const status = err.status || 500;
	const payload = {
		success: false,
		message: err.message || 'Error interno del servidor',
	};
	if (process.env.NODE_ENV !== 'production' && err.stack) {
		payload.stack = err.stack;
	}
	res.status(status).json(payload);
}

module.exports = errorHandler;



