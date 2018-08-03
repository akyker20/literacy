export interface IEmailContent {
  subject: string;
  text: string;
}

export interface IEmail {
  sendAdminEmail: (content: IEmailContent) => Promise<null>
  sendMail: (recipient: string, content: IEmailContent) => Promise<null>;
}