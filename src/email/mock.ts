import { IEmail, IEmailContent } from ".";

export class MockEmail implements IEmail {

  constructor(private log: boolean) { 
    console.log(`Using Mock email with ${log ? 'logging' : 'NO logging'}.`)
  }

  sendAdminEmail({ subject, text }: IEmailContent) {
    if (this.log) {
      console.log(`
      --------
      Sending Email
      recipient: ADMIN
      subject: ${subject}
      text:
      ${text}
    `)
    }
    return Promise.resolve(null);
  }

  sendMail(recipient: string, { subject, text }: IEmailContent) {
    if (this.log) {
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