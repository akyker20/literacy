import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Models as M } from 'reading_rewards';

type ReadingLog = M.IReadingLog;

export interface IReadingLogData {
  createLog: (log: ReadingLog) => Promise<ReadingLog>;
  deleteLog: (logId: string) => Promise<ReadingLog>;
  getLogsForStudent: (studentId: string) => Promise<ReadingLog[]>;
}

export class MongoReadingLogData implements IReadingLogData {

  private readingLogs: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.readingLogs = db.get('reading_logs', { castIds: false });
  }

  createLog(log: ReadingLog): Promise<ReadingLog> {
    const copy = _.cloneDeep(log);
    copy._id = shortid.generate();
    return this.readingLogs.insert(copy);
  }

  deleteLog(logId: string): Promise<ReadingLog> {
    return this.readingLogs.findOneAndDelete({ _id: logId });
  }

  getLogsForStudent(studentId: string): Promise<ReadingLog[]> {
    return this.readingLogs.find({ student_id: studentId });
  }

}
