import { 
  ClassScheduleArray, 
  TeacherScheduleArray, 
  TeacherHoursTracker, 
  TimetableData, 
  PlacementPriority,
  BacktrackState,
  PlacementHistory,
  Subject,
  Teacher,
  Class
} from '../types';
import { DAYS } from '../utils/helpers';
import { ConstraintCheckerImpl } from './constraintChecker';

// 우선순위 기반 배치 알고리즘
export class PriorityScheduler {
  private schedule: ClassScheduleArray;
  private teacherSchedule: TeacherScheduleArray;
  private teacherHours: TeacherHoursTracker;
  private data: TimetableData;
  private constraintChecker: ConstraintCheckerImpl;
  private placementHistory: PlacementHistory[];
  private maxBacktrackSteps: number;
  private currentBacktrackSteps: number;

  constructor(data: TimetableData, maxBacktrackSteps: number = 1000) {
    this.data = data;
    this.maxBacktrackSteps = maxBacktrackSteps;
    this.currentBacktrackSteps = 0;
    this.placementHistory = [];
    
    // 초기화
    this.initializeSchedules();
    this.constraintChecker = new ConstraintCheckerImpl(
      this.schedule,
      this.teacherSchedule,
      this.teacherHours,
      this.data
    );
  }

  // 스케줄 초기화
  private initializeSchedules(): void {
    this.schedule = {};
    this.teacherSchedule = {};
    this.teacherHours = {};

    // 학급별 스케줄 초기화
    this.data.classes.forEach(classData => {
      this.schedule[classData.id] = {};
      DAYS.forEach(day => {
        this.schedule[classData.id][day] = {};
        const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
        const maxPeriods = periodsPerDay[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          this.schedule[classData.id][day][period] = null;
        }
      });
    });

    // 교사별 스케줄 초기화
    this.data.teachers.forEach(teacher => {
      this.teacherSchedule[teacher.id] = {};
      this.teacherHours[teacher.name] = {
        current: 0,
        max: teacher.max_hours_per_week || teacher.maxHours || 22,
        subjects: {},
        classHours: {}
      };

      DAYS.forEach(day => {
        this.teacherSchedule[teacher.id][day] = {};
        const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
        const maxPeriods = periodsPerDay[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          this.teacherSchedule[teacher.id][day][period] = null;
        }
      });
    });
  }

  // 배치 우선순위 계산
  private calculatePlacementPriorities(): PlacementPriority[] {
    const priorities: PlacementPriority[] = [];

    this.data.classes.forEach(classData => {
      this.data.subjects.forEach(subject => {
        // 현재 배정된 과목 시수 계산
        let currentHours = 0;
        DAYS.forEach(day => {
          if (this.schedule[classData.id] && this.schedule[classData.id][day]) {
            Object.values(this.schedule[classData.id][day]).forEach(slot => {
              if (slot && slot.subject === subject.id) {
                currentHours++;
              }
            });
          }
        });

        // 목표 시수에 도달했으면 배치 불필요
        if (currentHours >= subject.weekly_hours) {
          return;
        }

        // 가능한 슬롯 수 계산
        const availableSlots = this.countAvailableSlots(classData.id, subject.id);
        
        // 필요한 교사들 찾기
        const requiredTeachers = this.findAvailableTeachers(subject.id, classData.id);
        
        // 배치 난이도 계산
        const difficulty = this.calculatePlacementDifficulty(subject, requiredTeachers, availableSlots);
        
        // 우선순위 계산
        const priority = this.calculatePriority(subject, classData, difficulty, availableSlots);

        priorities.push({
          subjectId: subject.id,
          classId: classData.id,
          priority,
          difficulty,
          availableSlots,
          requiredTeachers: requiredTeachers.map(t => t.id),
          isBlockSubject: subject.block || false,
          isCoTeaching: subject.requires_co_teaching || false
        });
      });
    });

    // 우선순위 내림차순 정렬 (높은 우선순위가 먼저)
    return priorities.sort((a, b) => b.priority - a.priority);
  }

  // 가능한 슬롯 수 계산
  private countAvailableSlots(classId: string, subjectId: string): number {
    let count = 0;
    const subject = this.data.subjects.find(s => s.id === subjectId);
    const requiredTeachers = this.findAvailableTeachers(subjectId, classId);

    DAYS.forEach(day => {
      if (this.schedule[classId] && this.schedule[classId][day]) {
        Object.entries(this.schedule[classId][day]).forEach(([periodStr, slot]) => {
          if (slot === null) {
            const period = parseInt(periodStr);
            
            // 블록제 과목인 경우 연속 2교시 확인
            if (subject?.block) {
              const nextPeriod = period + 1;
              const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
              const maxPeriods = periodsPerDay[day] || 7;
              
              if (nextPeriod <= maxPeriods && this.schedule[classId][day][nextPeriod] === null) {
                // 모든 필요한 교사가 해당 시간에 가능한지 확인
                const allTeachersAvailable = requiredTeachers.every(teacher => {
                  return this.constraintChecker.isTeacherAvailable(teacher.id, day, period).allowed &&
                         this.constraintChecker.isTeacherAvailable(teacher.id, day, nextPeriod).allowed;
                });
                
                if (allTeachersAvailable) {
                  count++;
                }
              }
            } else {
              // 일반 과목
              const allTeachersAvailable = requiredTeachers.every(teacher => {
                return this.constraintChecker.isTeacherAvailable(teacher.id, day, period).allowed;
              });
              
              if (allTeachersAvailable) {
                count++;
              }
            }
          }
        });
      }
    });

    return count;
  }

  // 사용 가능한 교사들 찾기
  private findAvailableTeachers(subjectId: string, classId: string): Teacher[] {
    return this.data.teachers.filter(teacher => 
      teacher.subjects.includes(subjectId)
    );
  }

  // 배치 난이도 계산
  private calculatePlacementDifficulty(
    subject: Subject, 
    requiredTeachers: Teacher[], 
    availableSlots: number
  ): number {
    let difficulty = 0;

    // 1. 블록제 과목은 더 어려움
    if (subject.block) {
      difficulty += 50;
    }

    // 2. 공동수업은 더 어려움
    if (subject.requires_co_teaching) {
      difficulty += 30;
    }

    // 3. 교사 수가 적을수록 어려움
    difficulty += (10 - Math.min(requiredTeachers.length, 10)) * 5;

    // 4. 가능한 슬롯이 적을수록 어려움
    difficulty += Math.max(0, 20 - availableSlots) * 2;

    // 5. 교사들의 가능 시간이 적을수록 어려움
    requiredTeachers.forEach(teacher => {
      if (teacher.available_times && teacher.available_times.length > 0) {
        difficulty += Math.max(0, 20 - teacher.available_times.length);
      }
    });

    return difficulty;
  }

  // 우선순위 계산
  private calculatePriority(
    subject: Subject, 
    classData: Class, 
    difficulty: number, 
    availableSlots: number
  ): number {
    let priority = 0;

    // 1. 과목 우선순위
    priority += (subject.priority || 0) * 10;

    // 2. 배치 난이도 (높을수록 우선)
    priority += difficulty;

    // 3. 과목 시수 (많을수록 우선)
    priority += subject.weekly_hours * 2;

    // 4. 가능한 슬롯이 적을수록 우선
    priority += Math.max(0, 20 - availableSlots) * 3;

    // 5. 학급 우선순위
    priority += (classData.grade * 10 + classData.class_number);

    return priority;
  }

  // 시간표 생성 메인 함수
  public generateTimetable(addLog: (message: string, type?: string) => void): {
    success: boolean;
    schedule: ClassScheduleArray;
    teacherSchedule: TeacherScheduleArray;
    teacherHours: TeacherHoursTracker;
    message: string;
  } {
    addLog('🚀 우선순위 기반 시간표 생성을 시작합니다.', 'info');

    try {
      // 1. 고정 수업 적용
      this.applyFixedClasses(addLog);

      // 2. 우선순위 기반 배치
      const success = this.placeByPriority(addLog);

      if (success) {
        addLog('✅ 시간표 생성이 완료되었습니다.', 'success');
        return {
          success: true,
          schedule: this.schedule,
          teacherSchedule: this.teacherSchedule,
          teacherHours: this.teacherHours,
          message: '시간표가 성공적으로 생성되었습니다.'
        };
      } else {
        addLog('❌ 조건을 만족하는 시간표를 만들 수 없습니다.', 'error');
        return {
          success: false,
          schedule: this.schedule,
          teacherSchedule: this.teacherSchedule,
          teacherHours: this.teacherHours,
          message: '조건을 만족하는 시간표를 만들 수 없습니다. 제약조건을 확인해주세요.'
        };
      }
    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error}`, 'error');
      return {
        success: false,
        schedule: this.schedule,
        teacherSchedule: this.teacherSchedule,
        teacherHours: this.teacherHours,
        message: `시간표 생성 중 오류가 발생했습니다: ${error}`
      };
    }
  }

  // 고정 수업 적용
  private applyFixedClasses(addLog: (message: string, type?: string) => void): void {
    addLog('📌 고정 수업을 적용합니다.', 'info');
    
    this.data.fixedClasses.forEach(fixedClass => {
      const classId = fixedClass.className || `${fixedClass.grade}학년_${fixedClass.class}반`;
      
      if (this.schedule[classId] && 
          this.schedule[classId][fixedClass.day] && 
          this.schedule[classId][fixedClass.day][fixedClass.period] === null) {
        
        // 고정 수업 배치
        this.schedule[classId][fixedClass.day][fixedClass.period] = {
          subject: fixedClass.subject,
          teachers: [fixedClass.teacher, ...fixedClass.coTeachers],
          isCoTeaching: fixedClass.coTeachers.length > 0,
          isFixed: true,
          source: 'fixed'
        };

        // 교사 스케줄 업데이트
        const allTeachers = [fixedClass.teacher, ...fixedClass.coTeachers];
        allTeachers.forEach(teacherId => {
          if (this.teacherSchedule[teacherId]) {
            this.teacherSchedule[teacherId][fixedClass.day][fixedClass.period] = {
              classId,
              subject: fixedClass.subject,
              isCoTeaching: fixedClass.coTeachers.length > 0
            };
          }
        });

        // 교사 시수 업데이트
        allTeachers.forEach(teacherId => {
          const teacher = this.data.teachers.find(t => t.id === teacherId);
          if (teacher && this.teacherHours[teacher.name]) {
            this.teacherHours[teacher.name].current++;
          }
        });

        addLog(`✅ 고정 수업 적용: ${classId} ${fixedClass.day}요일 ${fixedClass.period}교시 - ${fixedClass.subject}`, 'success');
      }
    });
  }

  // 우선순위 기반 배치
  private placeByPriority(addLog: (message: string, type?: string) => void): boolean {
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      attempts++;
      addLog(`🔄 배치 시도 ${attempts}/${maxAttempts}`, 'info');

      // 우선순위 재계산
      const priorities = this.calculatePlacementPriorities();
      
      if (priorities.length === 0) {
        addLog('✅ 모든 과목이 배정되었습니다.', 'success');
        return true;
      }

      // 가장 높은 우선순위의 과목부터 배치 시도
      let placed = false;
      for (const priority of priorities) {
        if (this.tryPlaceSubject(priority, addLog)) {
          placed = true;
          break;
        }
      }

      if (!placed) {
        // 백트래킹 시도
        if (this.backtrack(addLog)) {
          continue;
        } else {
          addLog('❌ 백트래킹으로도 해결할 수 없습니다.', 'error');
          return false;
        }
      }
    }

    addLog('❌ 최대 시도 횟수를 초과했습니다.', 'error');
    return false;
  }

  // 과목 배치 시도
  private tryPlaceSubject(priority: PlacementPriority, addLog: (message: string, type?: string) => void): boolean {
    const { subjectId, classId, isBlockSubject, requiredTeachers } = priority;
    const subject = this.data.subjects.find(s => s.id === subjectId);
    const classData = this.data.classes.find(c => c.id === classId);

    if (!subject || !classData) {
      return false;
    }

    // 가능한 슬롯들 찾기
    const availableSlots = this.findAvailableSlotsForSubject(priority);

    // 슬롯들을 점수 순으로 정렬 (높은 점수가 먼저)
    availableSlots.sort((a, b) => b.score - a.score);

    for (const slot of availableSlots) {
      // 배치 시도
      if (this.attemptPlacement(classId, slot.day, slot.period, subjectId, requiredTeachers, isBlockSubject)) {
        addLog(`✅ 배치 성공: ${classData.name} ${slot.day}요일 ${slot.period}교시 - ${subject.name}`, 'success');
        return true;
      }
    }

    return false;
  }

  // 과목을 위한 가능한 슬롯들 찾기
  private findAvailableSlotsForSubject(priority: PlacementPriority): Array<{
    day: string;
    period: number;
    score: number;
  }> {
    const { subjectId, classId, isBlockSubject, requiredTeachers } = priority;
    const slots: Array<{ day: string; period: number; score: number }> = [];

    DAYS.forEach(day => {
      if (this.schedule[classId] && this.schedule[classId][day]) {
        Object.entries(this.schedule[classId][day]).forEach(([periodStr, slot]) => {
          if (slot === null) {
            const period = parseInt(periodStr);
            let score = 0;

            if (isBlockSubject) {
              // 블록제 과목: 연속 2교시 확인
              const nextPeriod = period + 1;
              const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
              const maxPeriods = periodsPerDay[day] || 7;
              
              if (nextPeriod <= maxPeriods && this.schedule[classId][day][nextPeriod] === null) {
                score = this.calculateSlotScore(day, period, requiredTeachers, true);
                if (score > 0) {
                  slots.push({ day, period, score });
                }
              }
            } else {
              // 일반 과목
              score = this.calculateSlotScore(day, period, requiredTeachers, false);
              if (score > 0) {
                slots.push({ day, period, score });
              }
            }
          }
        });
      }
    });

    return slots;
  }

  // 슬롯 점수 계산
  private calculateSlotScore(
    day: string, 
    period: number, 
    requiredTeachers: string[], 
    isBlockSubject: boolean
  ): number {
    let score = 100;

    // 1. 교사들의 가능 시간 확인
    for (const teacherId of requiredTeachers) {
      const teacherCheck = this.constraintChecker.isTeacherAvailable(teacherId, day, period);
      if (!teacherCheck.allowed) {
        return 0;
      }

      // 블록제 과목인 경우 다음 교시도 확인
      if (isBlockSubject) {
        const nextPeriod = period + 1;
        const nextTeacherCheck = this.constraintChecker.isTeacherAvailable(teacherId, day, nextPeriod);
        if (!nextTeacherCheck.allowed) {
          return 0;
        }
      }
    }

    // 2. 교사 중복 배정 확인
    for (const teacherId of requiredTeachers) {
      const conflictCheck = this.constraintChecker.isTeacherConflictFree(teacherId, day, period);
      if (!conflictCheck.allowed) {
        return 0;
      }

      if (isBlockSubject) {
        const nextPeriod = period + 1;
        const nextConflictCheck = this.constraintChecker.isTeacherConflictFree(teacherId, day, nextPeriod);
        if (!nextConflictCheck.allowed) {
          return 0;
        }
      }
    }

    // 3. 시간대별 점수 조정
    if (period <= 3) score += 20; // 오전 수업 선호
    if (period >= 6) score -= 10; // 오후 수업 기피

    // 4. 요일별 점수 조정
    if (day === '월' || day === '화') score += 10; // 월화 선호
    if (day === '금') score -= 5; // 금요일 기피

    return score;
  }

  // 배치 시도
  private attemptPlacement(
    classId: string,
    day: string,
    period: number,
    subjectId: string,
    requiredTeachers: string[],
    isBlockSubject: boolean
  ): boolean {
    // 종합 검증
    const validation = this.constraintChecker.validatePlacement(classId, day, period, subjectId, requiredTeachers);
    if (!validation.allowed) {
      return false;
    }

    // 블록제 과목인 경우 다음 교시도 검증
    if (isBlockSubject) {
      const nextPeriod = period + 1;
      const nextValidation = this.constraintChecker.validatePlacement(classId, day, nextPeriod, subjectId, requiredTeachers);
      if (!nextValidation.allowed) {
        return false;
      }
    }

    // 배치 실행
    this.placeSubject(classId, day, period, subjectId, requiredTeachers, isBlockSubject);
    
    // 배치 기록
    this.placementHistory.push({
      classId,
      day,
      period,
      subjectId,
      teachers: requiredTeachers,
      timestamp: new Date()
    });

    return true;
  }

  // 실제 배치 실행
  private placeSubject(
    classId: string,
    day: string,
    period: number,
    subjectId: string,
    teachers: string[],
    isBlockSubject: boolean
  ): void {
    const subject = this.data.subjects.find(s => s.id === subjectId);

    // 학급 스케줄에 배치
    this.schedule[classId][day][period] = {
      subject: subjectId,
      teachers,
      isCoTeaching: teachers.length > 1,
      isFixed: false,
      source: 'priority',
      isBlockPeriod: isBlockSubject
    };

    // 블록제 과목인 경우 다음 교시도 배치
    if (isBlockSubject) {
      const nextPeriod = period + 1;
      this.schedule[classId][day][nextPeriod] = {
        subject: subjectId,
        teachers,
        isCoTeaching: teachers.length > 1,
        isFixed: false,
        source: 'priority',
        isBlockPeriod: true,
        blockPartner: period
      };
    }

    // 교사 스케줄 업데이트
    teachers.forEach(teacherId => {
      if (this.teacherSchedule[teacherId]) {
        this.teacherSchedule[teacherId][day][period] = {
          classId,
          subject: subjectId,
          isCoTeaching: teachers.length > 1
        };

        if (isBlockSubject) {
          const nextPeriod = period + 1;
          this.teacherSchedule[teacherId][day][nextPeriod] = {
            classId,
            subject: subjectId,
            isCoTeaching: teachers.length > 1
          };
        }
      }
    });

    // 교사 시수 업데이트
    teachers.forEach(teacherId => {
      const teacher = this.data.teachers.find(t => t.id === teacherId);
      if (teacher && this.teacherHours[teacher.name]) {
        const hoursToAdd = isBlockSubject ? 2 : 1;
        this.teacherHours[teacher.name].current += hoursToAdd;
      }
    });
  }

  // 백트래킹
  private backtrack(addLog: (message: string, type?: string) => void): boolean {
    this.currentBacktrackSteps++;
    
    if (this.currentBacktrackSteps > this.maxBacktrackSteps) {
      addLog('❌ 최대 백트래킹 횟수를 초과했습니다.', 'error');
      return false;
    }

    if (this.placementHistory.length === 0) {
      addLog('❌ 백트래킹할 배치 기록이 없습니다.', 'error');
      return false;
    }

    // 마지막 배치를 되돌리기
    const lastPlacement = this.placementHistory.pop()!;
    this.undoPlacement(lastPlacement);
    
    addLog(`🔄 백트래킹: ${lastPlacement.classId} ${lastPlacement.day}요일 ${lastPlacement.period}교시 ${lastPlacement.subjectId} 배치 취소`, 'warning');
    
    return true;
  }

  // 배치 되돌리기
  private undoPlacement(placement: PlacementHistory): void {
    const { classId, day, period, subjectId, teachers } = placement;
    const subject = this.data.subjects.find(s => s.id === subjectId);
    const isBlockSubject = subject?.block || false;

    // 학급 스케줄에서 제거
    this.schedule[classId][day][period] = null;
    
    if (isBlockSubject) {
      const nextPeriod = period + 1;
      this.schedule[classId][day][nextPeriod] = null;
    }

    // 교사 스케줄에서 제거
    teachers.forEach(teacherId => {
      if (this.teacherSchedule[teacherId]) {
        this.teacherSchedule[teacherId][day][period] = null;
        
        if (isBlockSubject) {
          const nextPeriod = period + 1;
          this.teacherSchedule[teacherId][day][nextPeriod] = null;
        }
      }
    });

    // 교사 시수 되돌리기
    teachers.forEach(teacherId => {
      const teacher = this.data.teachers.find(t => t.id === teacherId);
      if (teacher && this.teacherHours[teacher.name]) {
        const hoursToSubtract = isBlockSubject ? 2 : 1;
        this.teacherHours[teacher.name].current = Math.max(0, this.teacherHours[teacher.name].current - hoursToSubtract);
      }
    });
  }
}