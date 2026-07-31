import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from '../../schemas/review-document.schema.json' with { type: 'json' }
import type { ReviewDocument } from './types.ts'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validateFn = ajv.compile(schema)

export interface SchemaValidationResult {
  valid: boolean
  document?: ReviewDocument
  errors?: ErrorObject[]
}

export function validateReviewDocumentSchema(input: unknown): SchemaValidationResult {
  const valid = validateFn(input)
  if (!valid) {
    return { valid: false, errors: validateFn.errors ?? [] }
  }
  return { valid: true, document: input as unknown as ReviewDocument }
}

export const CURRENT_SCHEMA_VERSION = 1
