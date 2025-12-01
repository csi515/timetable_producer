import { expose } from 'comlink';
import { Scheduler } from './scheduler';
import { ScheduleConfig, ClassInfo, ScheduleResult, MultipleScheduleResult } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';

const api = {
    runScheduler(
        config: ScheduleConfig,
        subjects: Subject[],
        teachers: Teacher[],
        classes: ClassInfo[]
    ): ScheduleResult {
        const scheduler = new Scheduler(config, subjects, teachers, classes);
        return scheduler.generateWithRetry(10);
    },

    runSchedulerMultiple(
        config: ScheduleConfig,
        subjects: Subject[],
        teachers: Teacher[],
        classes: ClassInfo[],
        minCount: number = 3,
        maxAttempts: number = 50
    ): MultipleScheduleResult {
        const scheduler = new Scheduler(config, subjects, teachers, classes);
        return scheduler.generateMultiple(minCount, maxAttempts);
    }
};

expose(api);
export type SchedulerWorker = typeof api;
