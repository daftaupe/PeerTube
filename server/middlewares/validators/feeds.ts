import * as express from 'express'
import { check, query, param, oneOf } from 'express-validator/check'
import {
  isAccountIdExist,
  isAccountNameValid,
  isLocalAccountNameExist
} from '../../helpers/custom-validators/accounts'
import { join } from 'path'
import { isTestInstance } from '../../helpers/core-utils'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { isVideoExist } from '../../helpers/custom-validators/videos'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers'
import { SortField } from '../../../shared/models/videos/video-sort.type'
import { areValidationErrors } from './utils'

const urlShouldStartWith = CONFIG.WEBSERVER.URL + /feeds/
const isURLOptions = {
  require_host: true,
  require_tld: true
}

// We validate 'localhost', so we don't have the top level domain
if (isTestInstance()) {
  isURLOptions.require_tld = false
}

const feedsValidator = [
  query('format').optional().isIn([ 'atom', 'json', 'rss' ]).withMessage('Should have a valid format (rss, atom, json)'),
  query('accountId').optional().custom(isIdOrUUIDValid),
  query('accountName').optional().custom(isAccountNameValid),
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.accountId) {
      logger.debug('Checking feedsAccountValidator parameters', { parameters: req.query })
      if (!await isAccountIdExist(req.query.accountId, res)) return
    } else if (req.query.accountName) {
      logger.debug('Checking feedsAccountValidator parameters', { parameters: req.query })
      if (!await isLocalAccountNameExist(req.query.accountName, res)) return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  feedsValidator
}
