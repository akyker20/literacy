import { IEmail, IEmailContent } from ".";

export class MockEmail implements IEmail {

  constructor(private enableLogging: boolean) { 
    console.log(`Using Mock email with ${enableLogging ? 'logging' : 'NO logging'}.`)
  }

  sendAdminEmail({ subject, text }: IEmailContent) {
    if (this.enableLogging) {
      console.log(`
      --------
      Sending Email
      recipient: Admin
      subject: ${subject}
      text:
      ${text}
    `)
    }
    return Promise.resolve(null);
  }

  sendMail(recipient: string, { subject, text }: IEmailContent) {
    if (this.enableLogging) {
      console.log(`
      --------
      Sending Email
      recipient: ${recipient}
      subject: ${subject}
      text:
      ${text}
    `)
    }
    return Promise.resolve(null);
  }

}