import { UryError } from './uryClient.js'

export class PosEditError extends Error {
  constructor(code, message, { status = 400 } = {}) {
    super(message)
    this.name = 'PosEditError'
    this.code = code
    this.status = status
  }
}

export function rejectedByPos(err) {
  if (err instanceof UryError && err.code === 'validation') {
    return new PosEditError('rejected', err.message || 'The POS rejected this change.', { status: 422 })
  }
  return err
}
