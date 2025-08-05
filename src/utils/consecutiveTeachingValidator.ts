import { 
  ClassScheduleArray, 
  TeacherScheduleArray, 
  ConsecutiveTeachingConstraint,
  TimetableQualityScore 
} from '../types';
import { DAYS } from './helpers';

// 연속 수업 제한 검증 및 품질 점수 계산
export class ConsecutiveTeachingValidator {
  private schedule: ClassScheduleArray;
  private teacherSchedule: TeacherScheduleArray;
  private constraints: ConsecutiveTeachingConstraint[];

  constructor(
    schedule: ClassScheduleArray,
    teacherSchedule: TeacherScheduleArray,
    constraints: ConsecutiveTeachingConstraint[] = []
  ) {
    this.schedule = schedule;
    this.teacherSchedule = teacherSchedule;
    this.constraints = constraints;
  }

  // 시간표 품질 점수 계산
  public calculateQualityScore(): TimetableQualityScore {
    const consecutiveTeachingViolations = this.findConsecutiveTeachingViolations();
    const consecutiveTeachingScore = this.calculateConsecutiveTeachingScore(consecutiveTeachingViolations);
    
    const totalScore = 100 - consecutiveTeachingScore; // 기본 점수 100에서 페널티 차감

    return {
      totalScore: Math.max(0, totalScore),
      consecutiveTeachingScore,
      consecutiveTeachingViolations,
      otherScores: {
        // 향후 다른 품질 지표들 추가 가능
      }
    };
  }

  // 연속 수업 위반 찾기
  private findConsecutiveTeachingViolations(): Array<{
    teacherId: string;
    day: string;
    consecutiveHours: number;
    maxAllowed: number;
    penalty: number;
  }> {
    const violations: Array<{
      teacherId: string;
      day: string;
      consecutiveHours: number;
      maxAllowed: number;
      penalty: number;
    }> = [];

    // 모든 교사에 대해 검사
    Object.keys(this.teacherSchedule).forEach(teacherId => {
      const constraint = this.constraints.find(c => c.teacherId === teacherId);
      const maxConsecutiveHours = constraint?.maxConsecutiveHours || 2;
      const penaltyWeight = constraint?.penaltyWeight || 10;

      DAYS.forEach(day => {
        if (this.teacherSchedule[teacherId] && this.teacherSchedule[teacherId][day]) {
          const daySchedule = this.teacherSchedule[teacherId][day];
          const periods = Object.keys(daySchedule)
            .map(p => parseInt(p))
            .filter(p => daySchedule[p] !== null)
            .sort((a, b) => a - b);

          if (periods.length > 0) {
            const consecutiveHours = this.findMaxConsecutiveHours(periods);
            
            if (consecutiveHours > maxConsecutiveHours) {
              violations.push({
                teacherId,
                day,
                consecutiveHours,
                maxAllowed: maxConsecutiveHours,
                penalty: (consecutiveHours - maxConsecutiveHours) * penaltyWeight
              });
            }
          }
        }
      });
    });

    return violations;
  }

  // 최대 연속 수업 시간 계산
  private findMaxConsecutiveHours(periods: number[]): number {
    if (periods.length === 0) return 0;
    if (periods.length === 1) return 1;

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < periods.length; i++) {
      if (periods[i] === periods[i - 1] + 1) {
        // 연속된 교시
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        // 연속되지 않은 교시
        currentConsecutive = 1;
      }
    }

    return maxConsecutive;
  }

  // 연속 수업 점수 계산
  private calculateConsecutiveTeachingScore(violations: Array<{
    teacherId: string;
    day: string;
    consecutiveHours: number;
    maxAllowed: number;
    penalty: number;
  }>): number {
    return violations.reduce((total, violation) => total + violation.penalty, 0);
  }

  // 특정 교사의 특정 날짜에서 연속 수업 시간 확인
  public checkTeacherConsecutiveHours(teacherId: string, day: string): {
    consecutiveHours: number;
    maxAllowed: number;
    isViolation: boolean;
  } {
    const constraint = this.constraints.find(c => c.teacherId === teacherId);
    const maxAllowed = constraint?.maxConsecutiveHours || 2;

    if (!this.teacherSchedule[teacherId] || !this.teacherSchedule[teacherId][day]) {
      return {
        consecutiveHours: 0,
        maxAllowed,
        isViolation: false
      };
    }

    const daySchedule = this.teacherSchedule[teacherId][day];
    const periods = Object.keys(daySchedule)
      .map(p => parseInt(p))
      .filter(p => daySchedule[p] !== null)
      .sort((a, b) => a - b);

    const consecutiveHours = this.findMaxConsecutiveHours(periods);

    return {
      consecutiveHours,
      maxAllowed,
      isViolation: consecutiveHours > maxAllowed
    };
  }

  // 슬롯 배치 시 연속 수업 위반 가능성 예측
  public predictConsecutiveViolation(
    teacherId: string, 
    day: string, 
    period: number
  ): {
    wouldViolate: boolean;
    currentConsecutive: number;
    predictedConsecutive: number;
    maxAllowed: number;
  } {
    const constraint = this.constraints.find(c => c.teacherId === teacherId);
    const maxAllowed = constraint?.maxConsecutiveHours || 2;

    if (!this.teacherSchedule[teacherId] || !this.teacherSchedule[teacherId][day]) {
      return {
        wouldViolate: false,
        currentConsecutive: 0,
        predictedConsecutive: 1,
        maxAllowed
      };
    }

    const daySchedule = this.teacherSchedule[teacherId][day];
    const periods = Object.keys(daySchedule)
      .map(p => parseInt(p))
      .filter(p => daySchedule[p] !== null)
      .sort((a, b) => a - b);

    // 현재 연속 수업 시간 계산
    const currentConsecutive = this.findMaxConsecutiveHours(periods);

    // 새로운 교시 추가 시 연속 수업 시간 계산
    const newPeriods = [...periods, period].sort((a, b) => a - b);
    const predictedConsecutive = this.findMaxConsecutiveHours(newPeriods);

    return {
      wouldViolate: predictedConsecutive > maxAllowed,
      currentConsecutive,
      predictedConsecutive,
      maxAllowed
    };
  }

  // 연속 수업 제한을 고려한 슬롯 점수 조정
  public adjustSlotScoreForConsecutiveTeaching(
    baseScore: number,
    teacherId: string,
    day: string,
    period: number
  ): number {
    const prediction = this.predictConsecutiveViolation(teacherId, day, period);
    
    if (prediction.wouldViolate) {
      const constraint = this.constraints.find(c => c.teacherId === teacherId);
      const penaltyWeight = constraint?.penaltyWeight || 10;
      const penalty = (prediction.predictedConsecutive - prediction.maxAllowed) * penaltyWeight;
      
      return Math.max(0, baseScore - penalty);
    }

    return baseScore;
  }

  // 시간표 품질 요약 생성
  public generateQualitySummary(): {
    totalViolations: number;
    affectedTeachers: string[];
    worstDay: string;
    averageConsecutiveHours: number;
    recommendations: string[];
  } {
    const violations = this.findConsecutiveTeachingViolations();
    const affectedTeachers = [...new Set(violations.map(v => v.teacherId))];
    
    // 가장 위반이 많은 요일 찾기
    const dayViolations = new Map<string, number>();
    violations.forEach(v => {
      dayViolations.set(v.day, (dayViolations.get(v.day) || 0) + 1);
    });
    const worstDay = Array.from(dayViolations.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '없음';

    // 평균 연속 수업 시간 계산
    let totalConsecutiveHours = 0;
    let totalTeacherDays = 0;
    
    Object.keys(this.teacherSchedule).forEach(teacherId => {
      DAYS.forEach(day => {
        if (this.teacherSchedule[teacherId] && this.teacherSchedule[teacherId][day]) {
          const daySchedule = this.teacherSchedule[teacherId][day];
          const periods = Object.keys(daySchedule)
            .map(p => parseInt(p))
            .filter(p => daySchedule[p] !== null)
            .sort((a, b) => a - b);
          
          if (periods.length > 0) {
            totalConsecutiveHours += this.findMaxConsecutiveHours(periods);
            totalTeacherDays++;
          }
        }
      });
    });

    const averageConsecutiveHours = totalTeacherDays > 0 
      ? totalConsecutiveHours / totalTeacherDays 
      : 0;

    // 개선 권장사항 생성
    const recommendations: string[] = [];
    
    if (violations.length > 0) {
      recommendations.push(`${violations.length}개의 연속 수업 위반이 발견되었습니다.`);
      
      if (affectedTeachers.length > 0) {
        recommendations.push(`영향받는 교사: ${affectedTeachers.join(', ')}`);
      }
      
      if (worstDay !== '없음') {
        recommendations.push(`가장 문제가 많은 요일: ${worstDay}요일`);
      }
      
      recommendations.push('연속 수업을 줄이기 위해 수업 시간을 재배치하는 것을 권장합니다.');
    }

    if (averageConsecutiveHours > 2) {
      recommendations.push(`평균 연속 수업 시간이 ${averageConsecutiveHours.toFixed(1)}시간으로 높습니다.`);
    }

    return {
      totalViolations: violations.length,
      affectedTeachers,
      worstDay,
      averageConsecutiveHours: Math.round(averageConsecutiveHours * 10) / 10,
      recommendations
    };
  }
}