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
  Class,
  CandidateSlot,
  FailureAnalysis,
  ConsecutiveTeachingConstraint,
  TimetableQualityScore
} from '../types';
import { DAYS } from '../utils/helpers';
import { ConstraintCheckerImpl } from './constraintChecker';
import { ConsecutiveTeachingValidator } from '../utils/consecutiveTeachingValidator';

// 개선된 우선순위 기반 배치 알고리즘
export class EnhancedScheduler {
  private schedule: ClassScheduleArray;
  private teacherSchedule: TeacherScheduleArray;
  private teacherHours: TeacherHoursTracker;
  private data: TimetableData;
  private constraintChecker: ConstraintCheckerImpl;
  private consecutiveTeachingValidator: ConsecutiveTeachingValidator;
  private placementHistory: PlacementHistory[];
  private maxBacktrackSteps: number;
  private currentBacktrackSteps: number;
  private candidateSlotsCache: Map<string, CandidateSlot[]>;
  private failureAnalysis: FailureAnalysis;
  private consecutiveTeachingConstraints: ConsecutiveTeachingConstraint[];

  constructor(data: TimetableData, maxBacktrackSteps: number = 2000) {
    this.data = data;
    this.maxBacktrackSteps = maxBacktrackSteps;
    this.currentBacktrackSteps = 0;
    this.placementHistory = [];
    this.candidateSlotsCache = new Map();
    this.consecutiveTeachingConstraints = this.initializeConsecutiveTeachingConstraints();
    this.failureAnalysis = {
      totalAttempts: 0,
      successfulPlacements: 0,
      failedPlacements: 0,
      backtrackCount: 0,
      constraintViolations: [],
      performanceMetrics: {
        startTime: Date.now(),
        averagePlacementTime: 0,
        totalPlacementTime: 0
      }
    };
    
    // 초기화
    this.initializeSchedules();
    this.constraintChecker = new ConstraintCheckerImpl(
      this.schedule,
      this.teacherSchedule,
      this.teacherHours,
      this.data
    );
    this.consecutiveTeachingValidator = new ConsecutiveTeachingValidator(
      this.schedule,
      this.teacherSchedule,
      this.consecutiveTeachingConstraints
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

  // 연속 수업 제한 초기화
  private initializeConsecutiveTeachingConstraints(): ConsecutiveTeachingConstraint[] {
    return this.data.teachers.map(teacher => ({
      teacherId: teacher.id,
      maxConsecutiveHours: 2, // 기본값: 2시간
      penaltyWeight: 10 // 기본 페널티 가중치
    }));
  }

  // 향상된 배치 우선순위 계산
  private calculateEnhancedPlacementPriorities(): PlacementPriority[] {
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

        // 캐시된 후보 슬롯 사용
        const candidateSlots = this.getCandidateSlots(classData.id, subject.id);
        
        // 필요한 교사들 찾기
        const requiredTeachers = this.findAvailableTeachers(subject.id, classData.id);
        
        // 배치 난이도 계산
        const difficulty = this.calculateEnhancedPlacementDifficulty(subject, requiredTeachers, candidateSlots.length);
        
        // 우선순위 계산
        const priority = this.calculateEnhancedPriority(subject, classData, difficulty, candidateSlots.length, currentHours);

        priorities.push({
          subjectId: subject.id,
          classId: classData.id,
          priority,
          difficulty,
          availableSlots: candidateSlots.length,
          requiredTeachers: requiredTeachers.map(t => t.id),
          isBlockSubject: subject.block || false,
          isCoTeaching: subject.requires_co_teaching || false,
          currentHours,
          targetHours: subject.weekly_hours
        });
      });
    });

    // 우선순위 내림차순 정렬 (높은 우선순위가 먼저)
    return priorities.sort((a, b) => b.priority - a.priority);
  }

  // 캐시된 후보 슬롯 가져오기
  private getCandidateSlots(classId: string, subjectId: string): CandidateSlot[] {
    const cacheKey = `${classId}-${subjectId}`;
    
    if (this.candidateSlotsCache.has(cacheKey)) {
      return this.candidateSlotsCache.get(cacheKey)!;
    }

    const candidateSlots = this.calculateCandidateSlots(classId, subjectId);
    this.candidateSlotsCache.set(cacheKey, candidateSlots);
    
    return candidateSlots;
  }

  // 후보 슬롯 계산 (최적화된 버전)
  private calculateCandidateSlots(classId: string, subjectId: string): CandidateSlot[] {
    const slots: CandidateSlot[] = [];
    const subject = this.data.subjects.find(s => s.id === subjectId);
    const requiredTeachers = this.findAvailableTeachers(subjectId, classId);
    const isBlockSubject = subject?.block || false;

    DAYS.forEach(day => {
      if (this.schedule[classId] && this.schedule[classId][day]) {
        Object.entries(this.schedule[classId][day]).forEach(([periodStr, slot]) => {
          if (slot === null) {
            const period = parseInt(periodStr);
            
            if (isBlockSubject) {
              // 블록제 과목: 연속 2교시 확인
              const nextPeriod = period + 1;
              const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
              const maxPeriods = periodsPerDay[day] || 7;
              
              if (nextPeriod <= maxPeriods && this.schedule[classId][day][nextPeriod] === null) {
                const score = this.calculateEnhancedSlotScore(day, period, requiredTeachers, true);
                if (score > 0) {
                  slots.push({
                    day,
                    period,
                    score,
                    isBlockSlot: true,
                    nextPeriod
                  });
                }
              }
            } else {
              // 일반 과목
              const score = this.calculateEnhancedSlotScore(day, period, requiredTeachers, false);
              if (score > 0) {
                slots.push({
                  day,
                  period,
                  score,
                  isBlockSlot: false
                });
              }
            }
          }
        });
      }
    });

    // 점수 순으로 정렬
    return slots.sort((a, b) => b.score - a.score);
  }

  // 향상된 슬롯 점수 계산
  private calculateEnhancedSlotScore(
    day: string, 
    period: number, 
    requiredTeachers: Teacher[], 
    isBlockSubject: boolean
  ): number {
    let score = 100;

    // 1. 교사들의 가능 시간 확인
    for (const teacher of requiredTeachers) {
      const teacherCheck = this.constraintChecker.isTeacherAvailable(teacher.id, day, period);
      if (!teacherCheck.allowed) {
        return 0;
      }

      // 블록제 과목인 경우 다음 교시도 확인
      if (isBlockSubject) {
        const nextPeriod = period + 1;
        const nextTeacherCheck = this.constraintChecker.isTeacherAvailable(teacher.id, day, nextPeriod);
        if (!nextTeacherCheck.allowed) {
          return 0;
        }
      }
    }

    // 2. 교사 중복 배정 확인
    for (const teacher of requiredTeachers) {
      const conflictCheck = this.constraintChecker.isTeacherConflictFree(teacher.id, day, period);
      if (!conflictCheck.allowed) {
        return 0;
      }

      if (isBlockSubject) {
        const nextPeriod = period + 1;
        const nextConflictCheck = this.constraintChecker.isTeacherConflictFree(teacher.id, day, nextPeriod);
        if (!nextConflictCheck.allowed) {
          return 0;
        }
      }
    }

    // 3. 시간대별 점수 조정 (더 세밀한 조정)
    if (period <= 2) score += 30; // 1-2교시 최고 선호
    else if (period <= 4) score += 20; // 3-4교시 선호
    else if (period <= 6) score += 10; // 5-6교시 보통
    else score -= 20; // 7교시 이후 기피

    // 4. 요일별 점수 조정
    if (day === '월') score += 15; // 월요일 최고 선호
    else if (day === '화') score += 10; // 화요일 선호
    else if (day === '수') score += 5; // 수요일 보통
    else if (day === '목') score += 0; // 목요일 중립
    else score -= 10; // 금요일 기피

    // 5. 교사별 선호도 반영
    requiredTeachers.forEach(teacher => {
      if (teacher.available_times && teacher.available_times.length > 0) {
        const isPreferredTime = teacher.available_times.some(([d, p]) => d === day && p === period);
        if (isPreferredTime) {
          score += 20; // 선호 시간대 보너스
        }
      }
    });

    // 6. 연속 수업 제한 반영
    for (const teacher of requiredTeachers) {
      const adjustedScore = this.consecutiveTeachingValidator.adjustSlotScoreForConsecutiveTeaching(
        score,
        teacher.id,
        day,
        period
      );
      score = Math.min(score, adjustedScore); // 가장 낮은 점수로 조정
    }

    return score;
  }

  // 사용 가능한 교사들 찾기
  private findAvailableTeachers(subjectId: string, classId: string): Teacher[] {
    return this.data.teachers.filter(teacher => 
      teacher.subjects.includes(subjectId)
    );
  }

  // 향상된 배치 난이도 계산
  private calculateEnhancedPlacementDifficulty(
    subject: Subject, 
    requiredTeachers: Teacher[], 
    availableSlots: number
  ): number {
    let difficulty = 0;

    // 1. 블록제 과목은 더 어려움
    if (subject.block) {
      difficulty += 60;
    }

    // 2. 공동수업은 더 어려움
    if (subject.requires_co_teaching) {
      difficulty += 40;
    }

    // 3. 교사 수가 적을수록 어려움
    difficulty += (10 - Math.min(requiredTeachers.length, 10)) * 8;

    // 4. 가능한 슬롯이 적을수록 어려움
    difficulty += Math.max(0, 25 - availableSlots) * 3;

    // 5. 교사들의 가능 시간이 적을수록 어려움
    requiredTeachers.forEach(teacher => {
      if (teacher.available_times && teacher.available_times.length > 0) {
        difficulty += Math.max(0, 25 - teacher.available_times.length) * 2;
      } else {
        difficulty += 30; // available_times가 설정되지 않은 경우
      }
    });

    // 6. 과목 시수가 많을수록 어려움
    difficulty += subject.weekly_hours * 2;

    return difficulty;
  }

  // 향상된 우선순위 계산
  private calculateEnhancedPriority(
    subject: Subject, 
    classData: Class, 
    difficulty: number, 
    availableSlots: number,
    currentHours: number
  ): number {
    let priority = 0;

    // 1. 과목 우선순위
    priority += (subject.priority || 0) * 15;

    // 2. 배치 난이도 (높을수록 우선)
    priority += difficulty;

    // 3. 과목 시수 (많을수록 우선)
    priority += subject.weekly_hours * 3;

    // 4. 가능한 슬롯이 적을수록 우선
    priority += Math.max(0, 30 - availableSlots) * 4;

    // 5. 학급 우선순위
    priority += (classData.grade * 15 + classData.class_number);

    // 6. 현재 배정된 시수 (적을수록 우선)
    priority += Math.max(0, subject.weekly_hours - currentHours) * 5;

    // 7. 블록제 과목 우선
    if (subject.block) {
      priority += 50;
    }

    // 8. 공동수업 우선
    if (subject.requires_co_teaching) {
      priority += 30;
    }

    return priority;
  }

  // 시간표 생성 메인 함수
  public generateTimetable(addLog: (message: string, type?: string) => void): {
    success: boolean;
    schedule: ClassScheduleArray;
    teacherSchedule: TeacherScheduleArray;
    teacherHours: TeacherHoursTracker;
    message: string;
    failureAnalysis: FailureAnalysis;
  } {
    const startTime = Date.now();
    addLog('🚀 개선된 우선순위 기반 시간표 생성을 시작합니다.', 'info');

    try {
      // 1. 고정 수업 적용
      this.applyFixedClasses(addLog);

      // 2. 향상된 우선순위 기반 배치
      const success = this.placeByEnhancedPriority(addLog);

      // 성능 메트릭 계산
      const endTime = Date.now();
      this.failureAnalysis.performanceMetrics.totalPlacementTime = endTime - startTime;
      this.failureAnalysis.performanceMetrics.averagePlacementTime = 
        this.failureAnalysis.totalAttempts > 0 
          ? this.failureAnalysis.performanceMetrics.totalPlacementTime / this.failureAnalysis.totalAttempts 
          : 0;

      // 3. 시간표 품질 점수 계산
      if (success) {
        this.consecutiveTeachingValidator = new ConsecutiveTeachingValidator(
          this.schedule,
          this.teacherSchedule,
          this.consecutiveTeachingConstraints
        );
        const qualityScore = this.consecutiveTeachingValidator.calculateQualityScore();
        this.failureAnalysis.qualityScore = qualityScore;
        
        addLog('✅ 시간표 생성이 완료되었습니다.', 'success');
        addLog(`📊 성능 메트릭: 총 ${this.failureAnalysis.totalAttempts}회 시도, ${this.failureAnalysis.successfulPlacements}회 성공, ${this.failureAnalysis.backtrackCount}회 백트래킹`, 'info');
        addLog(`🎯 시간표 품질 점수: ${qualityScore.totalScore}/100`, 'info');
        
        // 연속 수업 위반 정보 출력
        if (qualityScore.consecutiveTeachingViolations.length > 0) {
          addLog(`⚠️ 연속 수업 위반: ${qualityScore.consecutiveTeachingViolations.length}건 발견`, 'warning');
          qualityScore.consecutiveTeachingViolations.forEach((violation, index) => {
            const teacher = this.data.teachers.find(t => t.id === violation.teacherId);
            addLog(`  ${index + 1}. ${teacher?.name || violation.teacherId} - ${violation.day}요일 ${violation.consecutiveHours}시간 연속 (최대 ${violation.maxAllowed}시간)`, 'warning');
          });
        } else {
          addLog('✅ 연속 수업 제한 준수 완료', 'success');
        }
        
        return {
          success: true,
          schedule: this.schedule,
          teacherSchedule: this.teacherSchedule,
          teacherHours: this.teacherHours,
          message: '시간표가 성공적으로 생성되었습니다.',
          failureAnalysis: this.failureAnalysis
        };
      } else {
        addLog('❌ 조건을 만족하는 시간표를 만들 수 없습니다.', 'error');
        this.analyzeFailureReasons(addLog);
        
        return {
          success: false,
          schedule: this.schedule,
          teacherSchedule: this.teacherSchedule,
          teacherHours: this.teacherHours,
          message: '조건을 만족하는 시간표를 만들 수 없습니다. 제약조건을 확인해주세요.',
          failureAnalysis: this.failureAnalysis
        };
      }
    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error}`, 'error');
      return {
        success: false,
        schedule: this.schedule,
        teacherSchedule: this.teacherSchedule,
        teacherHours: this.teacherHours,
        message: `시간표 생성 중 오류가 발생했습니다: ${error}`,
        failureAnalysis: this.failureAnalysis
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

  // 향상된 우선순위 기반 배치
  private placeByEnhancedPriority(addLog: (message: string, type?: string) => void): boolean {
    let attempts = 0;
    const maxAttempts = 150;

    while (attempts < maxAttempts) {
      attempts++;
      addLog(`🔄 배치 시도 ${attempts}/${maxAttempts}`, 'info');

      // 우선순위 재계산
      const priorities = this.calculateEnhancedPlacementPriorities();
      
      if (priorities.length === 0) {
        addLog('✅ 모든 과목이 배정되었습니다.', 'success');
        return true;
      }

      // 가장 높은 우선순위의 과목부터 배치 시도
      let placed = false;
      for (const priority of priorities) {
        this.failureAnalysis.totalAttempts++;
        const placementStartTime = Date.now();
        
        if (this.tryEnhancedPlaceSubject(priority, addLog)) {
          this.failureAnalysis.successfulPlacements++;
          const placementEndTime = Date.now();
          this.failureAnalysis.performanceMetrics.totalPlacementTime += (placementEndTime - placementStartTime);
          placed = true;
          break;
        } else {
          this.failureAnalysis.failedPlacements++;
        }
      }

      if (!placed) {
        // 향상된 백트래킹 시도
        if (this.enhancedBacktrack(addLog)) {
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

  // 향상된 과목 배치 시도
  private tryEnhancedPlaceSubject(priority: PlacementPriority, addLog: (message: string, type?: string) => void): boolean {
    const { subjectId, classId, isBlockSubject, requiredTeachers } = priority;
    const subject = this.data.subjects.find(s => s.id === subjectId);
    const classData = this.data.classes.find(c => c.id === classId);

    if (!subject || !classData) {
      return false;
    }

    // 캐시된 후보 슬롯들 사용
    const candidateSlots = this.getCandidateSlots(classId, subjectId);

    for (const slot of candidateSlots) {
      // 배치 시도
      if (this.attemptEnhancedPlacement(classId, slot, subjectId, requiredTeachers, isBlockSubject)) {
        addLog(`✅ 배치 성공: ${classData.name} ${slot.day}요일 ${slot.period}교시 - ${subject.name}`, 'success');
        return true;
      }
    }

    // 실패 원인 기록
    this.recordConstraintViolation(subjectId, classId, candidateSlots.length);
    return false;
  }

  // 향상된 배치 시도
  private attemptEnhancedPlacement(
    classId: string,
    slot: CandidateSlot,
    subjectId: string,
    requiredTeachers: string[],
    isBlockSubject: boolean
  ): boolean {
    // 종합 검증
    const validation = this.constraintChecker.validatePlacement(classId, slot.day, slot.period, subjectId, requiredTeachers);
    if (!validation.allowed) {
      return false;
    }

    // 블록제 과목인 경우 다음 교시도 검증
    if (isBlockSubject && slot.isBlockSlot) {
      const nextValidation = this.constraintChecker.validatePlacement(classId, slot.day, slot.nextPeriod!, subjectId, requiredTeachers);
      if (!nextValidation.allowed) {
        return false;
      }
    }

    // 배치 실행
    this.placeSubject(classId, slot.day, slot.period, subjectId, requiredTeachers, isBlockSubject);
    
    // 배치 기록
    this.placementHistory.push({
      classId,
      day: slot.day,
      period: slot.period,
      subjectId,
      teachers: requiredTeachers,
      timestamp: new Date(),
      slotScore: slot.score
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
      source: 'enhanced_priority',
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
        source: 'enhanced_priority',
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

    // 캐시 무효화
    this.invalidateCache(classId, subjectId);
  }

  // 캐시 무효화
  private invalidateCache(classId: string, subjectId: string): void {
    const cacheKey = `${classId}-${subjectId}`;
    this.candidateSlotsCache.delete(cacheKey);
  }

  // 향상된 백트래킹
  private enhancedBacktrack(addLog: (message: string, type?: string) => void): boolean {
    this.currentBacktrackSteps++;
    this.failureAnalysis.backtrackCount++;
    
    if (this.currentBacktrackSteps > this.maxBacktrackSteps) {
      addLog('❌ 최대 백트래킹 횟수를 초과했습니다.', 'error');
      return false;
    }

    if (this.placementHistory.length === 0) {
      addLog('❌ 백트래킹할 배치 기록이 없습니다.', 'error');
      return false;
    }

    // 스마트 백트래킹: 낮은 점수의 배치부터 되돌리기
    const lastPlacements = this.placementHistory.slice(-5); // 최근 5개 배치
    const worstPlacement = lastPlacements.reduce((worst, current) => 
      (current.slotScore || 0) < (worst.slotScore || 0) ? current : worst
    );

    // 해당 배치를 되돌리기
    this.undoPlacement(worstPlacement);
    
    // 히스토리에서 제거
    const index = this.placementHistory.findIndex(p => 
      p.classId === worstPlacement.classId && 
      p.day === worstPlacement.day && 
      p.period === worstPlacement.period &&
      p.subjectId === worstPlacement.subjectId
    );
    if (index !== -1) {
      this.placementHistory.splice(index, 1);
    }
    
    addLog(`🔄 스마트 백트래킹: ${worstPlacement.classId} ${worstPlacement.day}요일 ${worstPlacement.period}교시 ${worstPlacement.subjectId} 배치 취소 (점수: ${worstPlacement.slotScore})`, 'warning');
    
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

    // 캐시 무효화
    this.invalidateCache(classId, subjectId);
  }

  // 제약조건 위반 기록
  private recordConstraintViolation(subjectId: string, classId: string, availableSlots: number): void {
    this.failureAnalysis.constraintViolations.push({
      subjectId,
      classId,
      availableSlots,
      timestamp: new Date(),
      reason: availableSlots === 0 ? 'no_available_slots' : 'constraint_conflict'
    });
  }

  // 실패 원인 분석
  private analyzeFailureReasons(addLog: (message: string, type?: string) => void): void {
    addLog('🔍 실패 원인 분석:', 'info');
    
    const violationCounts = new Map<string, number>();
    this.failureAnalysis.constraintViolations.forEach(violation => {
      const key = `${violation.subjectId}-${violation.classId}`;
      violationCounts.set(key, (violationCounts.get(key) || 0) + 1);
    });

    // 가장 많이 실패한 과목-학급 조합
    const topFailures = Array.from(violationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    addLog('📊 가장 많이 실패한 과목-학급 조합:', 'info');
    topFailures.forEach(([key, count], index) => {
      const [subjectId, classId] = key.split('-');
      const subject = this.data.subjects.find(s => s.id === subjectId);
      const classData = this.data.classes.find(c => c.id === classId);
      addLog(`  ${index + 1}. ${classData?.name || classId} ${subject?.name || subjectId}: ${count}회 실패`, 'warning');
    });

    // 제약조건 위반 통계
    const noSlotsCount = this.failureAnalysis.constraintViolations.filter(v => v.reason === 'no_available_slots').length;
    const conflictCount = this.failureAnalysis.constraintViolations.filter(v => v.reason === 'constraint_conflict').length;

    addLog(`📈 제약조건 위반 통계:`, 'info');
    addLog(`  - 사용 가능한 슬롯 없음: ${noSlotsCount}회`, 'warning');
    addLog(`  - 제약조건 충돌: ${conflictCount}회`, 'warning');
    addLog(`  - 총 백트래킹: ${this.failureAnalysis.backtrackCount}회`, 'warning');
  }
}