import { IncomingWebhook } from '@slack/client'
import { INotificationSys } from './index';

export class SlackNotifications implements INotificationSys {

  private webhook: IncomingWebhook;

  constructor(url: string) {
    this.webhook = new IncomingWebhook(url);
  }

  sendMessage(message: string): Promise<any> {
    return this.webhook.send({
      icon_emoji: ":ghost:",
      username: 'rr-backend',
      text: message
    }).catch(err => console.log(`SLACK ERR:\n${err}`))
  }

}