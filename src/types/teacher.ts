export interface Teacher {
  id: string;
  name: string;
  subjects: string[]; // 담당 과목 ID 목록
  maxWeeklyHours: number; // 주간 최대 시수
  unavailableTimes: UnavailableTime[]; // 불가능한 시간
  isPriority: boolean; // 우선 배치 여부
  preferredTimes?: PreferredTime[]; // 선호 시간 (선택)
  isExternal: boolean; // 외부 강사 여부

  // 교육 현장 최적화 필드
  specializations?: string[]; // 전문 분야 (예: ['미적분', '확률과 통계'])
  experienceLevel?: 'beginner' | 'intermediate' | 'expert'; // 경력 수준
  maxDailyHours?: number; // 하루 최대 수업 시간 (기본값: 6)
  minRestBetweenClasses?: number; // 최소 쉬는 시간 (단위: 교시, 기본값: 0)
}

export interface UnavailableTime {
  day: string; // 요일 (월, 화, 수, 목, 금)
  period: number; // 교시
}

export interface PreferredTime {
  day: string; // 요일
  period: number; // 교시
  preference: 'morning' | 'afternoon'; // 선호 패턴
}

