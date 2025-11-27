import { TimetableEntry } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { ClassInfo, ScheduleConfig } from '../types/timetable';
import { ConstraintValidator } from './constraintValidator';

export interface CSPVariable {
  classId: string;
  subjectId: string;
  teacherIds: string[];
  requiredHours: number;
  priority: number;
  isBlockClass: boolean;
  blockHours?: number;
  requiresSpecialRoom: boolean;
  specialRoomType?: string;
  isCoTeaching: boolean;
  isExternalInstructor: boolean;
  preferConcentrated: boolean;
}

export interface CSPDomain {
  day: string;
  period: number;
  roomId?: string;
}

export class CSPSolver {
  private config: ScheduleConfig;
  private subjects: Subject[];
  private teachers: Teacher[];
  private classes: ClassInfo[];
  private validator: ConstraintValidator;
  private randomSeed: number;

  constructor(
    config: ScheduleConfig,
    subjects: Subject[],
    teachers: Teacher[],
    classes: ClassInfo[],
    randomSeed: number = Math.random() * 1000000
  ) {
    this.config = config;
    this.subjects = subjects;
    this.teachers = teachers;
    this.classes = classes;
    this.validator = new ConstraintValidator([], subjects, teachers);
    this.randomSeed = randomSeed || Math.random() * 1000000;
  }

  solve(): TimetableEntry[] {
    // 1. 변수 생성 (우선순위별 정렬 후 랜덤화)
    this.variables = this.createVariables();
    
    // 2. 도메인 생성
    const domains = this.createDomains();
    
    // 3. Backtracking으로 해결
    const assignments: TimetableEntry[] = [];
    const result = this.backtrack(this.variables, domains, assignments, 0);
    
    return result || [];
  }

  // 간단한 시드 기반 랜덤 생성기
  private random(): number {
    this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
    return this.randomSeed / 233280;
  }

  // 배열 셔플 (Fisher-Yates)
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private createVariables(): CSPVariable[] {
    const variables: CSPVariable[] = [];
    
    for (const classInfo of this.classes) {
      for (const subject of this.subjects) {
        const requiredHours = subject.weeklyHours;
        const teachersForSubject = this.teachers.filter(t => 
          t.subjects.includes(subject.id)
        );
        
        if (teachersForSubject.length === 0) continue;
        
        // 공동수업인 경우
        if (subject.isCoTeaching && subject.coTeachingTeachers) {
          const coTeachers = subject.coTeachingTeachers
            .map(id => this.teachers.find(t => t.id === id))
            .filter(t => t !== undefined) as Teacher[];
          
          if (coTeachers.length > 0) {
            variables.push({
              classId: classInfo.id,
              subjectId: subject.id,
              teacherIds: coTeachers.map(t => t.id),
              requiredHours,
              priority: this.calculatePriority(subject, coTeachers),
              isBlockClass: subject.isBlockClass,
              blockHours: subject.blockHours,
              requiresSpecialRoom: subject.requiresSpecialRoom,
              specialRoomType: subject.specialRoomType,
              isCoTeaching: true,
              isExternalInstructor: subject.isExternalInstructor,
              preferConcentrated: subject.preferConcentrated
            });
          }
        } else {
          // 일반 수업
          for (const teacher of teachersForSubject) {
            variables.push({
              classId: classInfo.id,
              subjectId: subject.id,
              teacherIds: [teacher.id],
              requiredHours,
              priority: this.calculatePriority(subject, [teacher]),
              isBlockClass: subject.isBlockClass,
              blockHours: subject.blockHours,
              requiresSpecialRoom: subject.requiresSpecialRoom,
              specialRoomType: subject.specialRoomType,
              isCoTeaching: false,
              isExternalInstructor: subject.isExternalInstructor,
              preferConcentrated: subject.preferConcentrated
            });
          }
        }
      }
    }
    
    // 우선순위별 정렬 후, 같은 우선순위 내에서 랜덤화
    const sorted = variables.sort((a, b) => a.priority - b.priority);
    
    // 같은 우선순위 그룹별로 랜덤화
    const grouped = new Map<number, CSPVariable[]>();
    for (const variable of sorted) {
      if (!grouped.has(variable.priority)) {
        grouped.set(variable.priority, []);
      }
      grouped.get(variable.priority)!.push(variable);
    }
    
    const randomized: CSPVariable[] = [];
    for (const priority of Array.from(grouped.keys()).sort((a, b) => a - b)) {
      const group = grouped.get(priority)!;
      randomized.push(...this.shuffle(group));
    }
    
    return randomized;
  }

  private calculatePriority(subject: Subject, teachers: Teacher[]): number {
    let priority = 1000; // 기본 우선순위
    
    // 1. 공동수업 (최우선)
    if (subject.isCoTeaching) {
      priority = 100;
    }
    // 2. 블록 수업
    else if (subject.isBlockClass) {
      priority = 200;
    }
    // 3. 특별실 필요
    else if (subject.requiresSpecialRoom) {
      priority = 300;
    }
    // 4. 외부 강사
    else if (subject.isExternalInstructor) {
      priority = 400;
    }
    // 5. 우선 배치 교사
    else if (teachers.some(t => t.isPriority)) {
      priority = 500;
    }
    // 6. 일반 과목
    else {
      priority = 600;
    }
    
    return priority;
  }

  private createDomains(): CSPDomain[] {
    const domains: CSPDomain[] = [];
    
    for (const day of this.config.days) {
      for (let period = 1; period <= this.config.maxPeriodsPerDay; period++) {
        domains.push({ day, period });
        // 특별실도 도메인에 추가 (나중에 필터링)
      }
    }
    
    return domains;
  }

  private backtrack(
    variables: CSPVariable[],
    domains: CSPDomain[],
    assignments: TimetableEntry[],
    index: number
  ): TimetableEntry[] | null {
    // 모든 변수에 할당 완료
    if (index >= variables.length) {
      this.validator = new ConstraintValidator(assignments, this.subjects, this.teachers);
      if (!this.validator.hasCriticalViolations()) {
        return assignments;
      }
      return null;
    }

    const variable = variables[index];
    
    // 블록 수업 처리
    if (variable.isBlockClass && variable.blockHours) {
      return this.assignBlockClass(variable, domains, assignments, index);
    }
    
    // 일반 수업 처리
    const validDomains = this.filterDomains(variable, domains, assignments);
    
    // 도메인 순서 랜덤화
    const shuffledDomains = this.shuffle(validDomains);
    
    for (const domain of shuffledDomains) {
      // 필요한 시수만큼 할당
      const hoursToAssign = variable.requiredHours;
      const newAssignments: TimetableEntry[] = [...assignments];
      
      for (let h = 0; h < hoursToAssign; h++) {
        const entry: TimetableEntry = {
          id: `${variable.classId}-${variable.subjectId}-${Date.now()}-${h}`,
          classId: variable.classId,
          subjectId: variable.subjectId,
          teacherId: variable.teacherIds[0],
          teacherIds: variable.teacherIds.length > 1 ? variable.teacherIds : undefined,
          day: domain.day,
          period: domain.period + h,
          roomId: variable.requiresSpecialRoom ? variable.specialRoomType : undefined,
          isBlockClass: false
        };
        
        newAssignments.push(entry);
      }
      
      // 제약조건 검증
      const tempValidator = new ConstraintValidator(newAssignments, this.subjects, this.teachers);
      if (!tempValidator.hasCriticalViolations()) {
        const result = this.backtrack(variables, domains, newAssignments, index + 1);
        if (result) return result;
      }
    }
    
    return null;
  }

  private assignBlockClass(
    variable: CSPVariable,
    domains: CSPDomain[],
    assignments: TimetableEntry[],
    index: number
  ): TimetableEntry[] | null {
    const blockHours = variable.blockHours || 3;
    const validDomains = this.filterDomainsForBlock(variable, domains, assignments, blockHours);
    
    for (const startDomain of validDomains) {
      const newAssignments: TimetableEntry[] = [...assignments];
      
      // 연속된 교시에 블록 수업 할당
      for (let i = 0; i < blockHours; i++) {
        const entry: TimetableEntry = {
          id: `${variable.classId}-${variable.subjectId}-${Date.now()}-${i}`,
          classId: variable.classId,
          subjectId: variable.subjectId,
          teacherId: variable.teacherIds[0],
          teacherIds: variable.teacherIds.length > 1 ? variable.teacherIds : undefined,
          day: startDomain.day,
          period: startDomain.period + i,
          roomId: variable.requiresSpecialRoom ? variable.specialRoomType : undefined,
          isBlockClass: true,
          blockStartPeriod: startDomain.period
        };
        
        newAssignments.push(entry);
      }
      
      // 제약조건 검증
      const tempValidator = new ConstraintValidator(newAssignments, this.subjects, this.teachers);
      if (!tempValidator.hasCriticalViolations()) {
        const result = this.backtrack(
          this.variables,
          domains,
          newAssignments,
          index + 1
        );
        if (result) return result;
      }
    }
    
    return null;
  }

  private filterDomains(
    variable: CSPVariable,
    domains: CSPDomain[],
    assignments: TimetableEntry[]
  ): CSPDomain[] {
    return domains.filter(domain => {
      // 교사 불가능 시간 체크
      for (const teacherId of variable.teacherIds) {
        const teacher = this.teachers.find(t => t.id === teacherId);
        if (teacher) {
          const isUnavailable = teacher.unavailableTimes.some(
            ut => ut.day === domain.day && ut.period === domain.period
          );
          if (isUnavailable) return false;
        }
      }
      
      // 이미 할당된 시간과 충돌 체크
      const conflicting = assignments.some(a => {
        const aTeacherIds = a.teacherIds || [a.teacherId];
        const vTeacherIds = variable.teacherIds;
        
        return (
          a.day === domain.day &&
          a.period === domain.period &&
          (aTeacherIds.some(id => vTeacherIds.includes(id)) ||
           (a.roomId && variable.requiresSpecialRoom && a.roomId === variable.specialRoomType))
        );
      });
      
      return !conflicting;
    });
  }

  private filterDomainsForBlock(
    variable: CSPVariable,
    domains: CSPDomain[],
    assignments: TimetableEntry[],
    blockHours: number
  ): CSPDomain[] {
    const validDomains = domains.filter(domain => {
      // 연속된 교시가 모두 가능한지 확인
      for (let i = 0; i < blockHours; i++) {
        const period = domain.period + i;
        if (period > this.config.maxPeriodsPerDay) return false;
        
        // 각 교시에 대해 제약조건 체크
        const tempDomain: CSPDomain = { day: domain.day, period };
        const validDomains = this.filterDomains(variable, [tempDomain], assignments);
        if (validDomains.length === 0) return false;
      }
      
      return true;
    });
    
    // 블록 수업 도메인도 랜덤화
    return this.shuffle(validDomains);
  }

  private variables: CSPVariable[] = [];

  private getRemainingVariables(startIndex: number): CSPVariable[] {
    // 전체 변수 목록에서 startIndex 이후의 변수들 반환
    return this.variables.slice(startIndex + 1);
  }
}

