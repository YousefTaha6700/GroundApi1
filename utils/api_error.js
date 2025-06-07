// @desc This class is responsible for operational errors (predictable errors)
class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Marks this error as operational
    }
}

module.exports = ApiError;
