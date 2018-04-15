import * as express from 'express'
import { CONFIG } from '../initializers'
import { asyncMiddleware, feedsValidator } from '../middlewares'
import { VideoModel } from '../models/video/video'
import * as Feed from 'pfeed'
import { ResultList } from '../../shared/models'
import { AccountModel } from '../models/account/account'

const feedsRouter = express.Router()

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

  let resultList: ResultList<VideoModel>
  const account: AccountModel = res.locals.account

  if (account) {
    resultList = await VideoModel.listUserVideosForApi(
      account.id,
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

  if (format === 'atom' || format === 'atom1') {
    res.set('Content-Type', 'application/atom+xml')
    return res.send(feed.atom1()).end()
  }

  if (format === 'json' || format === 'json1') {
    res.set('Content-Type', 'application/json')
    return res.send(feed.json1()).end()
  }

  if (format === 'rss' || format === 'rss2') {
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
