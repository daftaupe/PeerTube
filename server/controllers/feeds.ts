import * as express from 'express'
import * as Bluebird from 'bluebird'
import { getFormattedObjects } from '../helpers/utils'
import { CONFIG, STATIC_PATHS } from '../initializers'
import {
  asyncMiddleware,
  feedsValidator,
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
const Feed = require('pfeed')

const feedsRouter = express.Router()

// multipurpose endpoint
feedsRouter.use('/feeds/videos.(xml|json1?|rss2?|atom1?)',
  feedsValidator,
  asyncMiddleware(generateFeed)
)

// ---------------------------------------------------------------------------

export {
  feedsRouter
}

// ---------------------------------------------------------------------------

async function generateFeed (req: express.Request, res: express.Response, next: express.NextFunction) {
  let feed = initFeed()
  let feedStart = 0
  let feedCount = 10
  let feedSort = '-createdAt'

  // should we limit results to an account?
  // (beware, only user accounts have videos)
  let isAccountFiltering = false
  let accountId: number
  let accountName: string
  if (req.query.accountId || req.query.accountName) {
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
    resultList = await VideoModel.listUserVideosForApi(
      accountId,
      feedStart,
      feedCount,
      feedSort
    )
  } else {
    resultList = await Bluebird.resolve(VideoModel.listForApi(
      feedStart,
      feedCount,
      feedSort,
      req.query.filter
    ))
  }

  // adding video items to the feed, one at a time
  resultList.data.forEach(video => {
    const formattedAccount = video.VideoChannel.Account.toFormattedJSON()

    feed.addItem({
      title: video.name,
      id: video.url,
      link: video.url,
      description: video.getTruncatedDescription(),
      content: video.description,
      author: [{
        name: formattedAccount.displayName,
        link: formattedAccount.url
      }],
      date: video.publishedAt,
      torrent: [
        {
          title: video.name,
          url: 'https://example.com/test.torrent',
          size_in_bytes: 42
        }
      ]
    })
  })

  /*
  Now the feed generation is done, let's send it!
  */
  returnFeed(feed, req, res)
}

function initFeed () {
  const webserverUrl = CONFIG.WEBSERVER.URL

  return new Feed({
    title: CONFIG.INSTANCE.NAME,
    description: CONFIG.INSTANCE.SHORT_DESCRIPTION,
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    id: webserverUrl,
    link: webserverUrl,
    image: webserverUrl + '/client/assets/images/icons/icon-96x96.png',
    favicon: webserverUrl + '/client/assets/images/favicon.png',
    copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
    ` and potential licenses granted by each content's rightholder.`,
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
  const pathname = url.parse(req.originalUrl).pathname
  if (pathname.endsWith('.atom') ||
      pathname.endsWith('.atom1')) {
    res.set('Content-Type', 'application/atom+xml')
    res.send(feed.atom1())
  } else if (pathname.endsWith('.json') ||
             pathname.endsWith('.json1')) {
    res.set('Content-Type', 'application/json')
    res.send(feed.json1())
  } else if (pathname.endsWith('.rss') ||
             pathname.endsWith('.rss2')) {
    res.set('Content-Type', 'application/rss+xml')
    res.send(feed.rss2())
  // else we're in the ambiguous '.xml' case and we look at the format query parameter
  } else if (req.query.format === 'atom' ||
             req.query.format === 'atom1') {
    res.set('Content-Type', 'application/atom+xml')
    res.send(feed.atom1())
  } else {
    res.set('Content-Type', 'application/rss+xml')
    res.send(feed.rss2())
  }
}
