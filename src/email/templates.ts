import { Models, Helpers, Constants } from 'reading_rewards';
import * as moment from 'moment';
import { IEmailContent } from '.';

export namespace EmailTemplates {
  
  export const buildReadingLogEmail = (student: Models.IStudent, log: Models.IReadingLog): IEmailContent => {

    return {
      subject: `${Helpers.getFullName(student)} submitted Reading Log for ${log.book_title}`,
      text: `
        student: ${Helpers.getFullName(student)}
        date: ${moment(log.date).format('LLLL')}
        book: ${log.book_title}
        duration: ${Helpers.formatMin(log.duration_min)}
        pages read: ${log.final_page - log.start_page}
        start page: ${log.start_page}
        end page: ${log.final_page}
        finished book: ${log.is_last_log_for_book ? 'YES' : 'NO'}
        read with: ${log.read_with}
      `
    }

  }

  export const buildQuizSubEmail = (student: Models.IStudent, sub: Models.IQuizSubmission, attemptNum: number): IEmailContent => {

    return {
      subject: `${Helpers.getFullName(student)} ${sub.passed ? 'PASSED' : 'FAILED'} quiz for ${sub.book_title}`,
      text: `
        student: ${Helpers.getFullName(student)}
        date: ${moment(sub.date_created).format('LLLL')}
        book: ${sub.book_title}
        attempt #: ${attemptNum}
        passed: ${sub.passed ? 'YES' : 'NO'}
        score: ${sub.score}%
      `
    }

  }

  export const buildOrderedPrizeEmail = (student: Models.IStudent, prize: Models.IPrize, prizeOrder: Models.IPrizeOrder): IEmailContent => {

    return {
      subject: `${Helpers.getFullName(student)} ordered prize ${prize.title}`,
      text: `
        student: ${Helpers.getFullName(student)}
        date: ${moment(prizeOrder.date_created).format('LLLL')}
        prize title: ${prize.title}
        prize amazon url: ${prize.amazon_url}
        prize points: ${prize.price_usd * Constants.PrizePointsPerDollar}
      `
    }

  }
}