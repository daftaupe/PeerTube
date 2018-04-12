import { Component, Input, OnInit } from '@angular/core'
import { User } from '../users'
import { Video } from './video.model'
import { VideoService } from '../../shared/video/video.service'
import { environment } from '../../../environments/environment'
import { FeedFormat } from '../../../../../shared'

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html'
})
export class VideoMiniatureComponent implements OnInit {
  @Input() user: User
  @Input() video: Video

  syndication = {
    isSupported: true,
    items: {}
  }

  constructor (private videoService: VideoService) {}

  ngOnInit () {
    this.generateSyndicationList()
  }

  generateSyndicationList () {
    const feeds = this.videoService.getAccountFeed(
      this.video.account.name,
      (this.video.isLocal) ? environment.apiUrl : this.video.account.host
    )
    this.syndication.items['rss 2.0'] = feeds[FeedFormat.RSS]
    this.syndication.items['atom 1.0'] = feeds[FeedFormat.ATOM]
    this.syndication.items['json 1.0'] = feeds[FeedFormat.JSON]
  }

  isVideoNSFWForThisUser () {
    return this.video.isVideoNSFWForUser(this.user)
  }
}
