import * as nodemailer from 'nodemailer';
import { IEmail, IEmailContent } from ".";

export class NodemailerEmail implements IEmail {

  private transporter: nodemailer.Transporter;
  private adminEmail: string;

  constructor(adminEmail: string, options: any) {

    this.adminEmail = adminEmail;
    this.transporter = nodemailer.createTransport(options);
    
    // verify connection configuration
    this.transporter.verify(function (error, success) {
      if (error) {
        console.log('Error connecting email');
        throw error;
      } else {
        console.log('Email Server is ready to take our messages');
      }
    });

  }

  sendAdminEmail(content: IEmailContent) {
    return this.sendMail(this.adminEmail, content);
  }

  sendMail(recipient: string, { subject, text }: IEmailContent): Promise<null>  {
    return new Promise((res, rej) => {
      this.transporter.sendMail({
        to: recipient,
        subject,
        text
      }, function (err, info) {
        if (err) {
          console.log(`Error sending email to ${recipient}`)
          console.error(err);
          rej(err)
        }
        console.log('Sent email successfully')
        console.log(info);
        res(null)
      })
    })
  }

}