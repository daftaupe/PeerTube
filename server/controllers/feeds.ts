import * as express from 'express'
import * as Bluebird from 'bluebird'
import { getFormattedObjects } from '../helpers/utils'
import { CONFIG, STATIC_PATHS } from '../initializers'
import {
  asyncMiddleware,
  feedsValidator,
  feedsQueryCleaner,
  feedsMissingParameters,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  usersGetValidator,
  videosAddValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSearchValidator,
  videosSortValidator,
  videosUpdateValidator
} from '../middlewares'
import { VideoModel } from '../models/video/video'
import { UserModel } from '../models/account/user'
import { AccountModel } from '../models/account/account'
import * as url from 'url'
import { logger } from '../helpers/logger'
// @ts-ignore
const Feed = require('feed')

const feedsRouter = express.Router()

// multipurpose endpoint
feedsRouter.use('/feeds/videos.(xml|json(1)?|rss(2)?|atom(1)?)',
  feedsValidator,
  feedsMissingParameters,
  asyncMiddleware(generateFeed)
)

// ---------------------------------------------------------------------------

export {
  feedsRouter
}

// ---------------------------------------------------------------------------

async function generateFeed (req: express.Request, res: express.Response, next: express.NextFunction) {
  let feed = initFeed()

  // should we limit results to an account?
  // (beware, only user accounts have videos)
  let isAccountFiltering = false
  let accountId: number
  let accountName: string
  if (req.params.accountId ||
      req.params.accountName ||
      req.query.accountId ||
      req.query.accountName) {
    isAccountFiltering = true
  }

  if (req.query.accountId) {
    accountId = req.query.accountId
  } else if (req.query.accountName) {
    const userNameToId = await UserModel.loadByUsername(req.query.accountName)
    // we need the user id and not the account id, since only user accounts have videos
    accountId = userNameToId.toFormattedJSON().id
  }

  let resultList: {
    data: VideoModel[];
    total: number;
  }
  if (isAccountFiltering) {
    resultList = await Bluebird.resolve(VideoModel.listUserVideosForApi(
      accountId,
      req.query.start,
      req.query.count,
      req.query.sort
    ))
  } else {
    resultList = await Bluebird.resolve(VideoModel.listForApi(
      req.query.start,
      req.query.count,
      req.query.sort,
      req.query.filter
    ))
  }

  // adding video items to the feed, one at a time
  resultList.data.forEach(video => {
    let formattedAccount = video.toFormattedJSON().account

    feed.addItem({
      title: video.name,
      id: video.url,
      link: video.url,
      description: video.getTruncatedDescription(),
      content: video.description,
      author: [{
        name: formattedAccount.displayName,
        email: formattedAccount.url,
        link: formattedAccount.url
      }],
      date: video.publishedAt,
      image: CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOST +
             STATIC_PATHS.THUMBNAILS + video.getThumbnailName()
    })
  })

  /*
  Now the feed generation is done, let's send it!
  */
  returnFeed(feed, req, res)
}

function initFeed () {
  const webserverUrl = CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOST

  return new Feed({
    title: CONFIG.INSTANCE.NAME,
    description: CONFIG.INSTANCE.SHORT_DESCRIPTION,
    id: webserverUrl,
    link: webserverUrl,
    image: webserverUrl + '/client/assets/images/icons/icon-96x96.png',
    favicon: webserverUrl + '/client/assets/images/favicon.png',
    copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
     `and potential licenses given by content`,
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    generator: `Toraifōsu`, // ^.~
    feedLinks: {
      json: `${webserverUrl}/feeds/videos.json`,
      atom: `${webserverUrl}/feeds/videos.atom`,
      rss: `${webserverUrl}/feeds/videos.xml`
    },
    author: {
      name: 'instance admin of ' + CONFIG.INSTANCE.NAME,
      email: CONFIG.ADMIN.EMAIL,
      link: `${webserverUrl}/about`
    }
  })
}

function returnFeed (feed, req: express.Request, res: express.Response) {
  // if the pathname ends with a feed extension, respect it
  if (url.parse(req.originalUrl).pathname.endsWith('.atom') ||
      url.parse(req.originalUrl).pathname.endsWith('.atom1')) {
    res.set('Content-Type', 'application/atom+xml')
    res.send(feed.atom1())
  } else if (url.parse(req.originalUrl).pathname.endsWith('.json') ||
             url.parse(req.originalUrl).pathname.endsWith('.json1')) {
    res.set('Content-Type', 'application/json')
    res.send(feed.json1())
  } else if (url.parse(req.originalUrl).pathname.endsWith('.rss') ||
             url.parse(req.originalUrl).pathname.endsWith('.rss2') ||
             url.parse(req.originalUrl).pathname.endsWith('.xml')) {
    res.set('Content-Type', 'application/rss+xml')
    res.send(feed.rss2())
  // else we look at the format query parameter
  } else if (req.query.format === 'atom' ||
             req.query.format === 'atom1') {
    res.set('Content-Type', 'application/atom+xml')
    res.send(feed.atom1())
  } else if (req.query.format === 'json' ||
             req.query.format === 'json1') {
    res.set('Content-Type', 'application/json')
    res.send(feed.json1())
  // lastly we fall back to the rss default
  } else {
    res.set('Content-Type', 'application/rss+xml')
    res.send(feed.rss2())
  }
}
