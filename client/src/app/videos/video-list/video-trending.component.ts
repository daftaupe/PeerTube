import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { SortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'
import { FeedFormat } from '../../../../../shared/models/feeds/feed-format.enum'
import * as url from 'url'

@Component({
  selector: 'my-videos-trending',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage = 'Trending'
  currentRoute = '/videos/trending'
  defaultSort: SortField = '-views'
  syndication = {
    isSupported: true,
    items: {}
  }

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               protected authService: AuthService,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
    this.generateSyndicationList()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    return this.videoService.getVideos(newPagination, this.sort)
  }

  generateSyndicationList () {
    const feeds = this.videoService.getFeed()
    this.syndication.items['rss 2.0'] = feeds[FeedFormat.RSS]
    this.syndication.items['atom 1.0'] = feeds[FeedFormat.ATOM]
    this.syndication.items['json 1.0'] = feeds[FeedFormat.JSON]
  }
}
