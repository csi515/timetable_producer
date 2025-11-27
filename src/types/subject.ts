export interface Subject {
  id: string;
  name: string;
  weeklyHours: number; // 주간 시수
  requiresSpecialRoom: boolean; // 특별실 필요 여부
  specialRoomType?: string; // 특별실 종류 (예: 과학실, 음악실)
  isBlockClass: boolean; // 블록 수업 여부
  blockHours?: number; // 블록 수업 시 연속 교시 수 (3 또는 4)
  isCoTeaching: boolean; // 공동수업 여부
  coTeachingTeachers?: string[]; // 공동수업 참여 교사 ID 목록
  isExternalInstructor: boolean; // 외부 강사 여부
  preferConcentrated: boolean; // 하루 몰아서 배치 선호 (외부 강사용)
  priority: number; // 우선순위 (낮을수록 우선)
}

