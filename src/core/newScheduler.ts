import { 
  ClassScheduleArray, 
  TeacherScheduleArray, 
  TeacherHoursTracker, 
  TimetableData,
  Schedule
} from '../types';
import { PriorityScheduler } from './priorityScheduler';
import { PostValidator } from './postValidator';
import { calculateScheduleStats } from '../utils/statistics';

// 새로운 메인 스케줄러
export class NewScheduler {
  private data: TimetableData;
  private maxBacktrackSteps: number;

  constructor(data: TimetableData, maxBacktrackSteps: number = 1000) {
    this.data = data;
    this.maxBacktrackSteps = maxBacktrackSteps;
  }

  // 메인 시간표 생성 함수
  public async generateTimetable(
    addLog: (message: string, type?: string) => void,
    setProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
    schedule: Schedule;
    teacherHours: TeacherHoursTracker;
    stats: any;
    message: string;
  }> {
    addLog('🚀 새로운 우선순위 기반 시간표 생성을 시작합니다.', 'info');
    setProgress?.(10);

    try {
      // 1단계: 데이터 검증
      addLog('1단계: 입력 데이터를 검증합니다.', 'info');
      const dataValidation = this.validateInputData(addLog);
      if (!dataValidation.isValid) {
        addLog('❌ 입력 데이터 검증에 실패했습니다.', 'error');
        return {
          success: false,
          schedule: {},
          teacherHours: {},
          stats: {},
          message: '입력 데이터 검증에 실패했습니다. 데이터를 확인해주세요.'
        };
      }
      setProgress?.(20);

      // 2단계: 우선순위 기반 배치 알고리즘 실행
      addLog('2단계: 우선순위 기반 배치 알고리즘을 실행합니다.', 'info');
      const priorityScheduler = new PriorityScheduler(this.data, this.maxBacktrackSteps);
      const placementResult = priorityScheduler.generateTimetable(addLog);
      
      if (!placementResult.success) {
        addLog('❌ 조건을 만족하는 시간표를 만들 수 없습니다.', 'error');
        return {
          success: false,
          schedule: this.convertToLegacySchedule(placementResult.schedule),
          teacherHours: placementResult.teacherHours,
          stats: {},
          message: placementResult.message
        };
      }
      setProgress?.(70);

      // 3단계: 최종 검증
      addLog('3단계: 최종 검증을 수행합니다.', 'info');
      const postValidator = new PostValidator(
        placementResult.schedule,
        placementResult.teacherSchedule,
        placementResult.teacherHours,
        this.data
      );
      
      const validationResult = postValidator.validateTimetable(addLog);
      
      if (!validationResult.isValid) {
        addLog('❌ 최종 검증에 실패했습니다.', 'error');
        addLog('위반된 제약조건:', 'error');
        validationResult.violations.forEach((violation, index) => {
          addLog(`  ${index + 1}. ${violation}`, 'error');
        });
        
        return {
          success: false,
          schedule: this.convertToLegacySchedule(placementResult.schedule),
          teacherHours: placementResult.teacherHours,
          stats: {},
          message: '최종 검증에 실패했습니다. 제약조건을 확인해주세요.'
        };
      }
      setProgress?.(90);

      // 4단계: 통계 계산
      addLog('4단계: 통계를 계산합니다.', 'info');
      const stats = calculateScheduleStats(
        this.convertToLegacySchedule(placementResult.schedule),
        placementResult.teacherHours
      );
      setProgress?.(100);

      addLog('✅ 시간표 생성이 완료되었습니다!', 'success');
      
      return {
        success: true,
        schedule: this.convertToLegacySchedule(placementResult.schedule),
        teacherHours: placementResult.teacherHours,
        stats,
        message: '시간표가 성공적으로 생성되었습니다.'
      };

    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error}`, 'error');
      return {
        success: false,
        schedule: {},
        teacherHours: {},
        stats: {},
        message: `시간표 생성 중 오류가 발생했습니다: ${error}`
      };
    }
  }

  // 입력 데이터 검증
  private validateInputData(addLog: (message: string, type?: string) => void): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 1. 기본 데이터 검증
    if (!this.data.base) {
      errors.push('기본 설정이 없습니다.');
    }

    if (!this.data.subjects || this.data.subjects.length === 0) {
      errors.push('과목 정보가 없습니다.');
    }

    if (!this.data.teachers || this.data.teachers.length === 0) {
      errors.push('교사 정보가 없습니다.');
    }

    if (!this.data.classes || this.data.classes.length === 0) {
      errors.push('학급 정보가 없습니다.');
    }

    // 2. 과목별 ID 중복 검증
    const subjectIds = this.data.subjects?.map(s => s.id) || [];
    const uniqueSubjectIds = new Set(subjectIds);
    if (subjectIds.length !== uniqueSubjectIds.size) {
      errors.push('과목 ID에 중복이 있습니다.');
    }

    // 3. 교사별 ID 중복 검증
    const teacherIds = this.data.teachers?.map(t => t.id) || [];
    const uniqueTeacherIds = new Set(teacherIds);
    if (teacherIds.length !== uniqueTeacherIds.size) {
      errors.push('교사 ID에 중복이 있습니다.');
    }

    // 4. 학급별 ID 중복 검증
    const classIds = this.data.classes?.map(c => c.id) || [];
    const uniqueClassIds = new Set(classIds);
    if (classIds.length !== uniqueClassIds.size) {
      errors.push('학급 ID에 중복이 있습니다.');
    }

    // 5. 교사별 과목 검증
    this.data.teachers?.forEach(teacher => {
      teacher.subjects.forEach(subjectId => {
        const subject = this.data.subjects?.find(s => s.id === subjectId);
        if (!subject) {
          errors.push(`교사 ${teacher.name}의 과목 ${subjectId}가 존재하지 않습니다.`);
        }
      });
    });

    // 6. 고정 수업 검증
    this.data.fixedClasses?.forEach(fixedClass => {
      const classId = fixedClass.className || `${fixedClass.grade}학년_${fixedClass.class}반`;
      const classData = this.data.classes?.find(c => c.id === classId);
      if (!classData) {
        errors.push(`고정 수업의 학급 ${classId}가 존재하지 않습니다.`);
      }

      const subject = this.data.subjects?.find(s => s.id === fixedClass.subject);
      if (!subject) {
        errors.push(`고정 수업의 과목 ${fixedClass.subject}가 존재하지 않습니다.`);
      }

      const teacher = this.data.teachers?.find(t => t.id === fixedClass.teacher);
      if (!teacher) {
        errors.push(`고정 수업의 교사 ${fixedClass.teacher}가 존재하지 않습니다.`);
      }
    });

    if (errors.length > 0) {
      addLog('❌ 입력 데이터 검증 실패:', 'error');
      errors.forEach(error => {
        addLog(`  - ${error}`, 'error');
      });
    } else {
      addLog('✅ 입력 데이터 검증 완료', 'success');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 새로운 스케줄 형식을 기존 형식으로 변환
  private convertToLegacySchedule(classSchedule: ClassScheduleArray): Schedule {
    const legacySchedule: Schedule = {};

    Object.keys(classSchedule).forEach(classId => {
      const className = classId; // ID를 그대로 사용하거나 변환 로직 추가
      legacySchedule[className] = {};

      Object.keys(classSchedule[classId]).forEach(day => {
        legacySchedule[className][day] = {};

        Object.keys(classSchedule[classId][day]).forEach(periodStr => {
          const period = parseInt(periodStr);
          const slot = classSchedule[classId][day][period];

          if (slot) {
            legacySchedule[className][day][period] = slot;
          } else {
            legacySchedule[className][day][period] = '';
          }
        });
      });
    });

    return legacySchedule;
  }

  // 시간표 생성 가능성 사전 검사
  public checkFeasibility(addLog: (message: string, type?: string) => void): {
    isFeasible: boolean;
    issues: string[];
  } {
    addLog('🔍 시간표 생성 가능성을 검사합니다...', 'info');
    
    const issues: string[] = [];

    // 1. 총 필요 시수 vs 가능한 슬롯 수 검사
    const totalRequiredHours = this.calculateTotalRequiredHours();
    const totalAvailableSlots = this.calculateTotalAvailableSlots();

    if (totalRequiredHours > totalAvailableSlots) {
      issues.push(`총 필요 시수(${totalRequiredHours})가 가능한 슬롯 수(${totalAvailableSlots})를 초과합니다.`);
    }

    // 2. 교사별 시수 검사
    this.data.teachers?.forEach(teacher => {
      const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
      const requiredHours = this.calculateTeacherRequiredHours(teacher.id);
      
      if (requiredHours > maxHours) {
        issues.push(`교사 ${teacher.name}의 필요 시수(${requiredHours})가 최대 시수(${maxHours})를 초과합니다.`);
      }
    });

    // 3. 블록제 과목 검사
    const blockSubjects = this.data.subjects?.filter(s => s.block) || [];
    blockSubjects.forEach(subject => {
      const requiredSlots = this.calculateSubjectRequiredSlots(subject.id);
      const availableBlockSlots = this.calculateAvailableBlockSlots(subject.id);
      
      if (requiredSlots > availableBlockSlots) {
        issues.push(`블록제 과목 ${subject.name}의 필요 슬롯(${requiredSlots})이 가능한 블록 슬롯(${availableBlockSlots})을 초과합니다.`);
      }
    });

    // 4. 공동수업 검사
    const coTeachingSubjects = this.data.subjects?.filter(s => s.requires_co_teaching) || [];
    coTeachingSubjects.forEach(subject => {
      const availableCoTeachers = this.findAvailableCoTeachers(subject.id);
      if (availableCoTeachers.length < 2) {
        issues.push(`공동수업 과목 ${subject.name}에 필요한 교사가 부족합니다. (필요: 2명, 가능: ${availableCoTeachers.length}명)`);
      }
    });

    const isFeasible = issues.length === 0;

    if (isFeasible) {
      addLog('✅ 시간표 생성이 가능합니다.', 'success');
    } else {
      addLog('❌ 시간표 생성이 어려울 수 있습니다:', 'warning');
      issues.forEach(issue => {
        addLog(`  - ${issue}`, 'warning');
      });
    }

    return { isFeasible, issues };
  }

  // 총 필요 시수 계산
  private calculateTotalRequiredHours(): number {
    let total = 0;
    
    this.data.classes?.forEach(classData => {
      this.data.subjects?.forEach(subject => {
        const requiredHours = subject.weekly_hours || 1;
        total += requiredHours;
      });
    });

    return total;
  }

  // 총 가능한 슬롯 수 계산
  private calculateTotalAvailableSlots(): number {
    let total = 0;
    
    this.data.classes?.forEach(classData => {
      const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
      
      Object.values(periodsPerDay).forEach(periods => {
        total += periods;
      });
    });

    return total;
  }

  // 교사별 필요 시수 계산
  private calculateTeacherRequiredHours(teacherId: string): number {
    let total = 0;
    
    this.data.classes?.forEach(classData => {
      this.data.subjects?.forEach(subject => {
        const teacher = this.data.teachers?.find(t => t.id === teacherId);
        if (teacher && teacher.subjects.includes(subject.id)) {
          total += subject.weekly_hours || 1;
        }
      });
    });

    return total;
  }

  // 과목별 필요 슬롯 수 계산
  private calculateSubjectRequiredSlots(subjectId: string): number {
    let total = 0;
    
    this.data.classes?.forEach(classData => {
      const subject = this.data.subjects?.find(s => s.id === subjectId);
      if (subject) {
        total += subject.weekly_hours || 1;
      }
    });

    return total;
  }

  // 블록제 과목을 위한 가능한 슬롯 수 계산
  private calculateAvailableBlockSlots(subjectId: string): number {
    let total = 0;
    
    this.data.classes?.forEach(classData => {
      const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
      
      Object.values(periodsPerDay).forEach(periods => {
        // 연속 2교시가 가능한 슬롯 수
        total += Math.floor(periods / 2);
      });
    });

    return total;
  }

  // 공동수업을 위한 가능한 교사들 찾기
  private findAvailableCoTeachers(subjectId: string): string[] {
    return this.data.teachers?.filter(teacher => 
      teacher.subjects.includes(subjectId)
    ).map(t => t.id) || [];
  }
}