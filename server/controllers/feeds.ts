import * as express from 'express'
import { CONFIG } from '../initializers'
import { asyncMiddleware, feedsValidator } from '../middlewares'
import { VideoModel } from '../models/video/video'
import { UserModel } from '../models/account/user'
import * as Feed from 'pfeed'
import { ResultList } from '../../shared/models'

const feedsRouter = express.Router()

// multipurpose endpoint
feedsRouter.get('/feeds/videos.:format',
  asyncMiddleware(feedsValidator),
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

  // Should we limit results to an account?
  let accountId: number

  if (req.query.accountId) {
    accountId = req.query.accountId
  } else if (req.query.accountName) {
    const userNameToId = await UserModel.loadByUsername(req.query.accountName)
    // We need the user id and not the account id, since only user accounts have videos
    accountId = userNameToId.Account.id
  }

  let resultList: ResultList<VideoModel>

  if (accountId) {
    resultList = await VideoModel.listUserVideosForApi(
      accountId,
      feedStart,
      feedCount,
      feedSort,
      true
    )
  } else {
    resultList = await VideoModel.listForApi(
      feedStart,
      feedCount,
      feedSort,
      req.query.filter,
      true
    )
  }

  // Adding video items to the feed, one at a time
  resultList.data.forEach(video => {
    const formattedVideoFiles = video.getFormattedVideoFilesJSON()
    const torrents = formattedVideoFiles.map(videoFile => ({
      title: video.name,
      url: videoFile.torrentUrl,
      size_in_bytes: videoFile.size
    }))

    feed.addItem({
      title: video.name,
      id: video.url,
      link: video.url,
      description: video.getTruncatedDescription(),
      content: video.description,
      author: [
        {
          name: video.VideoChannel.Account.getDisplayName(),
          link: video.VideoChannel.Account.Actor.url
        }
      ],
      date: video.publishedAt,
      torrent: torrents
    })
  })

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
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

function sendFeed (feed, req: express.Request, res: express.Response) {
  const format = req.params.format

  if (format.endsWith('.atom') || format.endsWith('.atom1')) {
    res.set('Content-Type', 'application/atom+xml')
    return res.send(feed.atom1()).end()
  }

  if (format.endsWith('.json') || format.endsWith('.json1')) {
    res.set('Content-Type', 'application/json')
    return res.send(feed.json1()).end()
  }

  if (format.endsWith('.rss') || format.endsWith('.rss2')) {
    res.set('Content-Type', 'application/rss+xml')
    return res.send(feed.rss2()).end()
  }

  // We're in the ambiguous '.xml' case and we look at the format query parameter
  if (req.query.format === 'atom' || req.query.format === 'atom1') {
    res.set('Content-Type', 'application/atom+xml')
    return res.send(feed.atom1()).end()
  }

  res.set('Content-Type', 'application/rss+xml')
  return res.send(feed.rss2()).end()
}
