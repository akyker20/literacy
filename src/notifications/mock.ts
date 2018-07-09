import { INotificationSys } from './index';

export class MockNotifications implements INotificationSys {

  sendMessage(message: string): Promise<any> {
    return Promise.resolve(null);
  }

}