import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Models as M } from 'reading_rewards';

type ReadingLog = M.IReadingLog;

export interface IReadingLogData {
  getAllLogs: () => Promise<ReadingLog[]>
  getLogById: (id: string) => Promise<ReadingLog>;
  createLog: (log: ReadingLog) => Promise<ReadingLog>;
  getLogsForStudent: (studentId: string) => Promise<ReadingLog[]>;
  getLogsForStudents: (studentIds: string[]) => Promise<ReadingLog[]>;
  deleteLog: (logId: string) => Promise<ReadingLog>;
}

export class MongoReadingLogData implements IReadingLogData {

  private readingLogs: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.readingLogs = db.get('reading_logs', { castIds: false });
  }

  getAllLogs() {
    return this.readingLogs.find({})
  }

  getLogById(id: string): Promise<ReadingLog> {
    return this.readingLogs.findOne({ _id: id });
  }

  createLog(log: ReadingLog): Promise<ReadingLog> {
    const copy = _.cloneDeep(log);
    copy._id = shortid.generate();
    return this.readingLogs.insert(copy);
  }

  getLogsForStudent(studentId: string): Promise<ReadingLog[]> {
    return this.readingLogs.find({ student_id: studentId });
  }

  getLogsForStudents(studentIds: string[]): Promise<ReadingLog[]> {
    return this.readingLogs.find({ student_id: { $in: studentIds }});
  }

  deleteLog(logId: string): Promise<ReadingLog> {
    return this.readingLogs.findOneAndDelete({ _id: logId });
  }

}
