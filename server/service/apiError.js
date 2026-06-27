export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request') {
    super(message, 400)
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict') {
    super(message, 409)
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
  }
}
