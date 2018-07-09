export interface INotificationSys {
  sendMessage(message: string): Promise<any>
}