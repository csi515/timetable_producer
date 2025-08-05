import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 제약조건 설명 데이터
const constraintDescriptions = {
  // 🧑‍🏫 교사 관련 제약조건
  no_duplicate_teachers: {
    title: '교사 중복 금지',
    description: '한 교사가 같은 시간에 여러 반을 가르칠 수 없도록 합니다.',
    what: '동일한 교시에 한 교사가 여러 학급에 동시 배정되는 것을 방지합니다.',
    result: '교사가 시간 충돌 없이 한 번에 한 학급만 담당하게 됩니다.',
    ifNotSet: '교사가 같은 시간에 여러 반을 가르치게 되어 물리적으로 불가능한 상황이 발생할 수 있습니다.',
    priority: 'must',
    icon: '🚫'
  },
  teacher_same_class_daily_limit: {
    title: '교사 일일 학급 중복 금지',
    description: '같은 교사가 하루에 한 학급에 두 번 이상 들어가는 것을 방지합니다.',
    what: '한 교사가 같은 날에 특정 학급에 여러 번 수업하는 것을 제한합니다.',
    result: '교사와 학생 간의 수업 분산이 균형있게 이루어집니다.',
    ifNotSet: '특정 교사가 한 학급에 과도하게 집중되어 다른 학급 수업에 지장을 줄 수 있습니다.',
    priority: 'must',
    icon: '📅'
  },
  teacher_consecutive_restriction: {
    title: '교사 연속 수업 금지',
    description: '한 교사가 하루에 연속으로 수업하지 않도록 합니다.',
    what: '교사의 연속 수업을 완전히 금지하여 휴식 시간을 보장합니다.',
    result: '교사가 연속 수업 없이 적절한 휴식 시간을 가질 수 있습니다.',
    ifNotSet: '교사가 연속으로 수업하게 되어 피로도가 증가할 수 있습니다.',
    priority: 'optional',
    icon: '⏸️'
  },
  consecutive_teaching_limit: {
    title: '연속 수업 제한 (권장사항)',
    description: '교사의 연속 수업을 2시간으로 제한하여 피로도를 줄입니다.',
    what: '한 교사가 같은 날에 최대 2시간까지만 연속으로 수업할 수 있도록 제한합니다.',
    result: '교사의 피로도를 줄이고 수업 효율성을 높일 수 있습니다.',
    ifNotSet: '교사가 3시간 이상 연속 수업하게 되어 피로도가 증가할 수 있습니다.',
    priority: 'optional',
    icon: '⏰'
  },
  teacher_unavailable_time: {
    title: '교사 수업 불가 시간',
    description: '특정 교사의 특정 요일·교시에 수업 배정을 금지합니다.',
    what: '교사가 개인 사정으로 수업할 수 없는 시간을 지정합니다.',
    result: '교사의 개인 일정을 고려한 시간표가 생성됩니다.',
    ifNotSet: '교사가 수업할 수 없는 시간에 배정되어 실제 운영에 문제가 발생할 수 있습니다.',
    priority: 'must',
    icon: '🚷'
  },
  teacher_max_daily_hours: {
    title: '교사 일일 최대 수업 수',
    description: '한 교사의 하루 최대 수업 수를 제한합니다.',
    what: '교사가 하루에 가질 수 있는 최대 수업 시간을 설정합니다.',
    result: '교사의 과도한 업무 부담을 방지할 수 있습니다.',
    ifNotSet: '교사가 하루에 과도한 수업을 담당하게 되어 피로도가 증가할 수 있습니다.',
    priority: 'optional',
    icon: '📊'
  },
  teacher_subject_conflict: {
    title: '교사 과목 충돌 방지',
    description: '두 과목을 가르치는 교사의 과목이 동시에 열리지 않도록 합니다.',
    what: '한 교사가 담당하는 여러 과목이 같은 시간에 배정되지 않도록 방지합니다.',
    result: '교사가 담당 과목 간 시간 충돌 없이 수업할 수 있습니다.',
    ifNotSet: '교사가 담당하는 과목들이 같은 시간에 배정되어 수업 진행이 불가능할 수 있습니다.',
    priority: 'must',
    icon: '⚡'
  },
  teacher_preferred_time: {
    title: '교사 선호 시간대',
    description: '특정 교사의 선호 시간대에 수업을 우선 배정합니다.',
    what: '교사가 선호하는 요일이나 교시에 수업을 배정하도록 우선순위를 부여합니다.',
    result: '교사의 선호도를 반영한 만족도 높은 시간표가 생성됩니다.',
    ifNotSet: '교사의 선호도가 반영되지 않아 만족도가 낮을 수 있습니다.',
    priority: 'optional',
    icon: '⭐'
  },
  teacher_class_restriction: {
    title: '교사-학급 배정 제한',
    description: '특정 교사가 특정 반을 가르치지 않도록 제한합니다.',
    what: '교사와 학급 간의 배정을 제한하여 특정 조합을 방지합니다.',
    result: '원하지 않는 교사-학급 조합을 피할 수 있습니다.',
    ifNotSet: '원하지 않는 교사-학급 조합이 발생할 수 있습니다.',
    priority: 'optional',
    icon: '🚫'
  },
  co_teaching_requirement: {
    title: '공동 수업 요구사항',
    description: '특정 교사가 다른 교사와 함께 수업해야 합니다.',
    what: '주교사와 부교사가 함께 수업하는 공동 수업을 지정된 시간에 배정합니다.',
    result: '공동 수업이 필요한 과목이 적절한 시간에 배정됩니다.',
    ifNotSet: '공동 수업이 필요한 과목이 단독 수업으로 배정될 수 있습니다.',
    priority: 'must',
    icon: '🤝'
  },
  specific_teacher_co_teaching: {
    title: '특정 교사의 공동수업',
    description: '특정 교사가 반드시 다른 교사와 함께 수업해야 합니다.',
    what: '주교사가 부교사 후보들과 골고루 공동 수업을 진행하도록 합니다.',
    result: '공동 수업이 필요한 교사의 부담을 여러 교사가 분담합니다.',
    ifNotSet: '특정 교사가 과도한 공동 수업을 담당하게 될 수 있습니다.',
    priority: 'optional',
    icon: '👥'
  },
  // 🏫 학급 관련 제약조건
  no_duplicate_classes: {
    title: '학급 중복 금지',
    description: '한 학급이 같은 시간에 여러 과목을 들을 수 없도록 합니다.',
    what: '동일한 교시에 한 학급에 여러 과목이 배정되는 것을 방지합니다.',
    result: '학생들이 시간 충돌 없이 수업을 들을 수 있습니다.',
    ifNotSet: '학생들이 같은 시간에 여러 과목을 들어야 하는 불가능한 상황이 발생할 수 있습니다.',
    priority: 'must',
    icon: '🚫'
  },
  class_daily_subject_limit: {
    title: '학급 일일 과목 중복 금지',
    description: '하루에 특정 과목이 중복되지 않도록 합니다.',
    what: '같은 과목이 하루에 여러 번 배정되는 것을 방지합니다.',
    result: '학생들이 다양한 과목을 균형있게 학습할 수 있습니다.',
    ifNotSet: '특정 과목이 하루에 과도하게 집중되어 학습 효율이 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '📚'
  },
  class_max_daily_periods: {
    title: '학급 일일 최대 교시 수',
    description: '한 학급의 하루 최대 교시 수를 제한합니다.',
    what: '학급이 하루에 가질 수 있는 최대 수업 시간을 설정합니다.',
    result: '학생들의 과도한 학습 부담을 방지할 수 있습니다.',
    ifNotSet: '학생들이 하루에 과도한 수업을 들어야 할 수 있습니다.',
    priority: 'must',
    icon: '⏰'
  },
  class_consecutive_subject_restriction: {
    title: '학급 연속 과목 제한',
    description: '한 과목의 수업이 연속된 시간으로 배정되지 않도록 합니다.',
    what: '특정 과목이 연속된 교시에 배정되는 것을 방지합니다.',
    result: '학생들이 다양한 과목을 골고루 학습할 수 있습니다.',
    ifNotSet: '특정 과목이 연속으로 배정되어 학습 효율이 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '🔄'
  },
  class_daily_subject_once: {
    title: '학급 일일 과목 1회 제한',
    description: '체육, 음악, 실험 등 특정 과목은 하루에 한 번만 편성합니다.',
    what: '특정 과목이 하루에 한 번만 배정되도록 제한합니다.',
    result: '학생들이 특정 과목에 과도하게 집중하지 않고 균형있게 학습할 수 있습니다.',
    ifNotSet: '특정 과목이 하루에 여러 번 배정되어 학습 균형이 깨질 수 있습니다.',
    priority: 'optional',
    icon: '1️⃣'
  },
  class_daily_distribution: {
    title: '학급 일일 과목 분산',
    description: '한 학급의 하루 시간표가 과도하게 치우치지 않도록 분산 배정합니다.',
    what: '학급의 하루 수업이 특정 시간대에 집중되지 않도록 분산합니다.',
    result: '학생들이 하루 종일 균형있게 학습할 수 있습니다.',
    ifNotSet: '수업이 특정 시간대에 집중되어 학습 효율이 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '📈'
  },
  // 📚 과목 관련 제약조건
  subject_weekly_hours: {
    title: '과목 주당 시수 고정',
    description: '주당 시수가 고정되어 있어야 합니다.',
    what: '각 과목의 주간 수업 시간이 정확히 배정되도록 합니다.',
    result: '교육과정에 맞는 정확한 수업 시간이 보장됩니다.',
    ifNotSet: '과목별 주간 수업 시간이 부족하거나 초과될 수 있습니다.',
    priority: 'must',
    icon: '📅'
  },
  subject_fixed_time: {
    title: '과목 고정 시간',
    description: '특정 과목은 반드시 특정 요일/교시에 배정합니다.',
    what: '특정 과목을 지정된 시간에 고정 배정합니다.',
    result: '특별한 이유로 고정이 필요한 과목이 원하는 시간에 배정됩니다.',
    ifNotSet: '고정이 필요한 과목이 다른 시간에 배정될 수 있습니다.',
    priority: 'must',
    icon: '📌'
  },
  subject_consecutive_periods: {
    title: '과목 연속 교시 필요',
    description: '특정 과목은 연속 2교시 이상이 필요합니다.',
    what: '실험, 체육 등 연속 수업이 필요한 과목을 연속 교시에 배정합니다.',
    result: '연속 수업이 필요한 과목이 적절하게 배정됩니다.',
    ifNotSet: '연속 수업이 필요한 과목이 분리되어 배정될 수 있습니다.',
    priority: 'must',
    icon: '🔗'
  },
  subject_teacher_requirement: {
    title: '과목-교사 배정 제한',
    description: '특정 과목은 특정 교사만 담당합니다.',
    what: '특정 과목을 특정 교사만 가르칠 수 있도록 제한합니다.',
    result: '전문성이 필요한 과목이 적절한 교사에게 배정됩니다.',
    ifNotSet: '전문성이 없는 교사가 특정 과목을 담당할 수 있습니다.',
    priority: 'optional',
    icon: '👨‍🏫'
  },
  subject_fixed_only: {
    title: '고정수업 전용 과목',
    description: '특정 과목들을 고정수업으로만 배치하고 랜덤 배치를 제외합니다.',
    what: '선택된 과목들이 고정 수업으로만 배정되고 자동 배정에서 제외됩니다.',
    result: '중요한 과목들이 수동으로 관리되어 안정적인 시간표가 생성됩니다.',
    ifNotSet: '중요한 과목들이 자동 배정되어 예상치 못한 시간에 배정될 수 있습니다.',
    priority: 'optional',
    icon: '🔒'
  },
  subject_blocked_period: {
    title: '과목별 시간 제한',
    description: '특정 과목을 특정 시간에 배치하지 않습니다.',
    what: '특정 과목이 지정된 시간에 배정되지 않도록 제한합니다.',
    result: '과목의 특성에 맞지 않는 시간 배정을 방지할 수 있습니다.',
    ifNotSet: '과목의 특성에 맞지 않는 시간에 배정될 수 있습니다.',
    priority: 'optional',
    icon: '🚫'
  },
  avoid_consecutive_subjects: {
    title: '연속 수업 금지',
    description: '같은 과목이 연속으로 배치되지 않도록 합니다.',
    what: '특정 과목이 연속된 교시에 배정되는 것을 방지합니다.',
    result: '학생들이 다양한 과목을 골고루 학습할 수 있습니다.',
    ifNotSet: '특정 과목이 연속으로 배정되어 학습 효율이 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '⏸️'
  },
  morning_priority_subjects: {
    title: '오전 우선 과목',
    description: '특정 과목을 오전 시간에 우선 배치합니다.',
    what: '중요한 과목들을 오전 시간대에 우선적으로 배정합니다.',
    result: '학생들이 집중력이 높은 오전 시간에 중요한 과목을 학습할 수 있습니다.',
    ifNotSet: '중요한 과목이 오후 시간에 배정되어 학습 효율이 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '🌅'
  },
  afternoon_priority_subjects: {
    title: '오후 우선 과목',
    description: '특정 과목을 오후 시간에 우선 배치합니다.',
    what: '체육, 실습 등 오후에 적합한 과목들을 오후 시간대에 우선 배정합니다.',
    result: '과목의 특성에 맞는 시간대에 배정되어 학습 효과가 높아집니다.',
    ifNotSet: '오후에 적합한 과목이 오전에 배정되어 학습 효과가 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '🌆'
  },
  max_daily_subject_hours: {
    title: '일일 과목 시수 제한',
    description: '하루에 같은 과목을 최대 몇 시간까지만 배치합니다.',
    what: '특정 과목이 하루에 배정될 수 있는 최대 시간을 제한합니다.',
    result: '학생들이 특정 과목에 과도하게 집중하지 않고 균형있게 학습할 수 있습니다.',
    ifNotSet: '특정 과목이 하루에 과도하게 배정되어 학습 균형이 깨질 수 있습니다.',
    priority: 'optional',
    icon: '📊'
  },
  // 🧰 기타 조건
  space_constraint: {
    title: '공간 제약',
    description: '특별실 사용 과목의 동시 수업 제한합니다.',
    what: '특별실이 필요한 과목들이 동시에 배정되지 않도록 제한합니다.',
    result: '특별실 사용 충돌 없이 수업이 진행될 수 있습니다.',
    ifNotSet: '여러 과목이 같은 특별실을 동시에 사용하려고 하여 충돌이 발생할 수 있습니다.',
    priority: 'must',
    icon: '🏫'
  },
  free_period: {
    title: '공강 시간 설정',
    description: '특정 시간은 공강 시간으로 설정합니다.',
    what: '지정된 시간을 수업 없이 비워둡니다.',
    result: '학생들이 휴식 시간을 가질 수 있습니다.',
    ifNotSet: '모든 시간에 수업이 배정되어 학생들이 휴식할 시간이 없을 수 있습니다.',
    priority: 'optional',
    icon: '☕'
  },
  pe_concurrent_limit: {
    title: '체육 동시 수업 제한',
    description: '체육 수업은 학년별 동시 수용 가능한 최대 학급 수를 넘지 않도록 합니다.',
    what: '체육 수업이 동시에 진행될 수 있는 학급 수를 제한합니다.',
    result: '체육 시설 사용 충돌 없이 수업이 진행될 수 있습니다.',
    ifNotSet: '여러 학급이 동시에 체육 수업을 하려고 하여 시설 사용에 문제가 발생할 수 있습니다.',
    priority: 'optional',
    icon: '⚽'
  },
  subject_exclusive_time: {
    title: '과목 배타적 시간',
    description: '특정 과목은 같은 시간에 여러 반에서 동시에 배정되면 안 됩니다.',
    what: '특정 과목이 여러 학급에서 동시에 진행되지 않도록 제한합니다.',
    result: '과목별 특성에 맞는 독립적인 수업 환경이 보장됩니다.',
    ifNotSet: '여러 학급에서 동시에 같은 과목을 진행하여 학습 효과가 떨어질 수 있습니다.',
    priority: 'optional',
    icon: '🔒'
  },
  first_last_period_limit: {
    title: '첫/마지막 교시 제한',
    description: '교사 또는 학급의 첫/마지막 수업이 너무 이르거나 늦지 않도록 합니다.',
    what: '교사나 학급의 첫 수업과 마지막 수업 시간을 제한합니다.',
    result: '교사와 학생 모두 적절한 시간에 수업을 시작하고 종료할 수 있습니다.',
    ifNotSet: '교사나 학생이 너무 이르거나 늦은 시간에 수업을 해야 할 수 있습니다.',
    priority: 'optional',
    icon: '⏰'
  },
  similar_subject_conflict: {
    title: '유사 과목 충돌 방지',
    description: '비슷한 과목이 동일 시간에 배정되지 않도록 합니다.',
    what: '성격이 비슷한 과목들이 같은 시간에 배정되는 것을 방지합니다.',
    result: '학생들이 유사한 과목을 동시에 학습하지 않아 혼란을 방지할 수 있습니다.',
    ifNotSet: '유사한 과목이 동시에 배정되어 학습에 혼란이 생길 수 있습니다.',
    priority: 'optional',
    icon: '🔄'
  },
  classroom_requirement: {
    title: '교실 배정 제한',
    description: '특정 수업은 특정 교실에서만 진행 가능합니다.',
    what: '특정 과목을 지정된 교실에서만 수업하도록 제한합니다.',
    result: '과목의 특성에 맞는 적절한 교실에서 수업이 진행됩니다.',
    ifNotSet: '과목의 특성에 맞지 않는 교실에서 수업이 진행될 수 있습니다.',
    priority: 'optional',
    icon: '🏠'
  },
  fourth_period_distribution: {
    title: '4교시 수업 분산 제약',
    description: '한 교사에게 4교시 수업이 과도하게 집중되지 않도록 분산 배정합니다.',
    what: '교사별로 4교시 수업이 균등하게 분산되도록 합니다.',
    result: '교사들의 4교시 수업 부담이 균등하게 분산됩니다.',
    ifNotSet: '특정 교사에게 4교시 수업이 과도하게 집중될 수 있습니다.',
    priority: 'optional',
    icon: '📊'
  },
  // 🎯 블록제 수업 제약조건
  block_period_requirement: {
    title: '블록제 수업',
    description: '특정 수업은 연속된 두 교시에 배치되어야 합니다.',
    what: '실험, 체육, 프로젝트 등 연속 수업이 필요한 과목을 2교시 연속으로 배정합니다.',
    result: '연속 수업이 필요한 과목이 적절하게 배정됩니다.',
    ifNotSet: '연속 수업이 필요한 과목이 분리되어 배정되어 수업 진행이 어려울 수 있습니다.',
    priority: 'must',
    icon: '🔗'
  }
};

// 툴팁 컴포넌트
const Tooltip = ({ children, content, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-gray-900 text-white text-sm rounded-lg p-3 max-w-xs shadow-lg">
            {content}
            <div className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
              position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
              position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
              'right-full top-1/2 -translate-y-1/2 -mr-1'
            }`}></div>
          </div>
        </div>
      )}
    </div>
  );
};

// 드래그 가능한 조건 아이템 컴포넌트
function SortableConstraintItem({ constraint, index, priority, onRemove, getConstraintTypeName }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${priority}-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const borderColor = priority === 'must' ? '#dc3545' : '#fd7e14';
  const textColor = priority === 'must' ? '#dc3545' : '#fd7e14';
  const bgColor = priority === 'must' ? '#fef2f2' : '#fff7ed';

  // 삭제 버튼 클릭 핸들러 (이벤트 전파 중지)
  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove(priority, index);
  };

  const constraintDesc = constraintDescriptions[constraint.type];
  const tooltipContent = constraintDesc ? (
    <div className="space-y-2">
      <div className="font-semibold">{constraintDesc.title}</div>
      <div className="text-xs">
        <div className="mb-1"><strong>🎯 의미:</strong> {constraintDesc.what}</div>
        <div className="mb-1"><strong>✅ 결과:</strong> {constraintDesc.result}</div>
        <div className="mb-1"><strong>⚠️ 미설정 시:</strong> {constraintDesc.ifNotSet}</div>
        <div><strong>우선순위:</strong> {constraintDesc.priority === 'must' ? '필수 조건' : '권장 조건'}</div>
      </div>
    </div>
  ) : getConstraintTypeName(constraint.type);

  return (
    <div 
      ref={setNodeRef} 
      className="card" 
      style={{ 
        marginBottom: '10px', 
        border: `2px solid ${borderColor}`,
        backgroundColor: bgColor,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 드래그 핸들과 컨텐츠 영역 */}
        <div 
          {...attributes} 
          {...listeners}
          style={{ 
            flex: 1, 
            minWidth: 0, 
            cursor: 'grab',
            padding: '5px 0'
          }}
        >
          <div className="flex items-center">
            <span className="text-xl mr-2" title={constraintDesc?.title || getConstraintTypeName(constraint.type)}>
              {constraintDesc?.icon || '📋'}
            </span>
            <Tooltip content={tooltipContent}>
              <h4 className="text-ellipsis" style={{ color: textColor, marginBottom: '5px' }} title={getConstraintTypeName(constraint.type)}>
                {getConstraintTypeName(constraint.type)}
                <span className="ml-2 text-sm">ℹ️</span>
              </h4>
            </Tooltip>
          </div>
          {constraint.subject && (
            <p className="text-ellipsis">
              <strong>{constraint.type === 'block_period_requirement' ? '교사' : '과목'}:</strong> <span title={constraint.subject === 'all' ? '모든 수업에 해당' : constraint.subject}>
                {constraint.subject === 'all' ? '모든 수업에 해당' : constraint.subject}
              </span>
            </p>
          )}
          {constraint.subjects && constraint.subjects.length > 0 && (
            <p className="text-ellipsis">
              <strong>고정수업 전용 과목:</strong> <span title={constraint.subjects.join(', ')}>
                {constraint.subjects.length > 3 ? 
                  `${constraint.subjects.slice(0, 3).join(', ')}... (${constraint.subjects.length}개)` : 
                  constraint.subjects.join(', ')
                }
              </span>
            </p>
          )}
          {constraint.day && <p className="text-ellipsis"><strong>시간:</strong> {constraint.day}요일 {constraint.period}교시</p>}
          {constraint.mainTeacher && (
            <p className="text-ellipsis">
              <strong>주교사:</strong> <span title={constraint.mainTeacher}>{constraint.mainTeacher}</span>
            </p>
          )}
          {constraint.coTeachers && constraint.coTeachers.length > 0 && (
            <p className="text-ellipsis">
              <strong>부교사:</strong> <span title={constraint.coTeachers.join(', ')}>{constraint.coTeachers.join(', ')}</span>
            </p>
          )}
          {constraint.maxTeachers && (
            <p className="text-ellipsis">
              <strong>최대 교사 수:</strong> {constraint.maxTeachers}명
            </p>
          )}
          {constraint.description && <p className="text-ellipsis-2" style={{ color: '#666' }} title={constraint.description}>{constraint.description}</p>}
          
          {/* 우선순위 표시 */}
          <div className="mt-2">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              priority === 'must' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              {priority === 'must' ? '🚫 필수 조건' : '💡 권장 조건'}
            </span>
          </div>
        </div>
        
        {/* 삭제 버튼 (드래그 이벤트와 분리) */}
        <button 
          className="btn btn-danger"
          onClick={handleDelete}
          style={{ 
            padding: '5px 10px', 
            fontSize: '12px',
            marginLeft: '10px',
            flexShrink: 0
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function ConstraintSettings({ data, updateData, nextStep, prevStep }) {
  const [constraints, setConstraints] = useState(data.constraints || { must: [], optional: [] });
  const [newConstraint, setNewConstraint] = useState({
    type: '',
    priority: 'must',
    subject: '',
    subjects: [],
    day: '',
    period: '',
    description: '',
    mainTeacher: '',
    coTeachers: [],
    maxTeachers: 2
  });

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const days = ['월', '화', '수', '목', '금'];
  const constraintTypes = [
    // 🧑‍🏫 교사 관련 제약조건
    {
      id: 'no_duplicate_teachers',
      name: '교사 중복 금지',
      description: '한 교사가 같은 시간에 여러 반을 가르칠 수 없음',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_same_class_daily_limit',
      name: '교사 일일 학급 중복 금지',
      description: '같은 교사가 하루에 한 학급에 두 번 이상 들어갈 수 없음',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_consecutive_restriction',
      name: '교사 연속 수업 금지',
      description: '한 교사가 하루에 연속으로 수업하지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'consecutive_teaching_limit',
      name: '연속 수업 제한 (권장사항)',
      description: '교사의 연속 수업을 2시간으로 제한하여 피로도 감소 (권장사항)',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_unavailable_time',
      name: '교사 수업 불가 시간',
      description: '특정 교사의 특정 요일·교시 수업 불가능',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'teacher_max_daily_hours',
      name: '교사 일일 최대 수업 수',
      description: '한 교사의 하루 최대 수업 수 제한',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_subject_conflict',
      name: '교사 과목 충돌 방지',
      description: '두 과목을 가르치는 교사의 과목이 동시에 열리지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'teacher_preferred_time',
      name: '교사 선호 시간대',
      description: '특정 교사의 선호 시간대에 수업 배정',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'teacher_class_restriction',
      name: '교사-학급 배정 제한',
      description: '특정 교사가 특정 반을 가르치지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'co_teaching_requirement',
      name: '공동 수업 요구사항',
      description: '특정 교사가 다른 교사와 함께 수업해야 함',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'specific_teacher_co_teaching',
      name: '특정 교사의 공동수업',
      description: '특정 교사가 반드시 다른 교사와 함께 수업해야 함 (부교사 후보들을 골고루 배분)',
      hasSubject: false,
      hasTime: false
    },
    // 🏫 학급 관련 제약조건
    {
      id: 'no_duplicate_classes',
      name: '학급 중복 금지',
      description: '한 학급이 같은 시간에 여러 과목을 들을 수 없음',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'class_daily_subject_limit',
      name: '학급 일일 과목 중복 금지',
      description: '하루에 특정 과목이 중복되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'class_max_daily_periods',
      name: '학급 일일 최대 교시 수',
      description: '한 학급의 하루 최대 교시 수 제한',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'class_consecutive_subject_restriction',
      name: '학급 연속 과목 제한',
      description: '한 과목의 수업이 연속된 시간으로 배정되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'class_daily_subject_once',
      name: '학급 일일 과목 1회 제한',
      description: '체육, 음악, 실험 등 특정 과목은 하루에 한 번만 편성',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'class_daily_distribution',
      name: '학급 일일 과목 분산',
      description: '한 학급의 하루 시간표가 과도하게 치우치지 않도록 분산 배정',
      hasSubject: false,
      hasTime: false
    },
    // 📚 과목 관련 제약조건
    {
      id: 'subject_weekly_hours',
      name: '과목 주당 시수 고정',
      description: '주당 시수가 고정되어 있어야 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'subject_fixed_time',
      name: '과목 고정 시간',
      description: '특정 과목은 반드시 특정 요일/교시에 배정',
      hasSubject: true,
      hasTime: true
    },
    {
      id: 'subject_consecutive_periods',
      name: '과목 연속 교시 필요',
      description: '특정 과목은 연속 2교시 이상이 필요',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'subject_teacher_requirement',
      name: '과목-교사 배정 제한',
      description: '특정 과목은 특정 교사만 담당',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'subject_fixed_only',
      name: '고정수업 전용 과목',
      description: '특정 과목들을 고정수업으로만 배치하고 랜덤 배치 제외',
      hasSubject: false,
      hasTime: false,
      hasSubjects: true
    },
    {
      id: 'subject_blocked_period',
      name: '과목별 시간 제한',
      description: '특정 과목을 특정 시간에 배치하지 않음',
      hasSubject: true,
      hasTime: true
    },
    {
      id: 'avoid_consecutive_subjects',
      name: '연속 수업 금지',
      description: '같은 과목이 연속으로 배치되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'morning_priority_subjects',
      name: '오전 우선 과목',
      description: '특정 과목을 오전 시간에 우선 배치',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'afternoon_priority_subjects',
      name: '오후 우선 과목',
      description: '특정 과목을 오후 시간에 우선 배치',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'max_daily_subject_hours',
      name: '일일 과목 시수 제한',
      description: '하루에 같은 과목을 최대 몇 시간까지만 배치',
      hasSubject: true,
      hasTime: false
    },
    // 🧰 기타 조건
    {
      id: 'space_constraint',
      name: '공간 제약',
      description: '특별실 사용 과목의 동시 수업 제한',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'free_period',
      name: '공강 시간 설정',
      description: '특정 시간은 공강 시간으로 설정',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'pe_concurrent_limit',
      name: '체육 동시 수업 제한',
      description: '체육 수업은 학년별 동시 수용 가능한 최대 학급 수를 넘지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'subject_exclusive_time',
      name: '과목 배타적 시간',
      description: '특정 과목은 같은 시간에 여러 반에서 동시에 배정되면 안 됨',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'first_last_period_limit',
      name: '첫/마지막 교시 제한',
      description: '교사 또는 학급의 첫/마지막 수업이 너무 이르거나 늦지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'similar_subject_conflict',
      name: '유사 과목 충돌 방지',
      description: '비슷한 과목이 동일 시간에 배정되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'classroom_requirement',
      name: '교실 배정 제한',
      description: '특정 수업은 특정 교실에서만 진행 가능',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'fourth_period_distribution',
      name: '4교시 수업 분산 제약',
      description: '한 교사에게 4교시 수업이 과도하게 집중되지 않도록 분산 배정',
      hasSubject: false,
      hasTime: false
    },
    // 🎯 블록제 수업 제약조건
    {
      id: 'block_period_requirement',
      name: '블록제 수업',
      description: '특정 수업은 연속된 두 교시에 배치되어야 함 (예: 실험, 체육, 프로젝트 등)',
      hasSubject: true,
      hasTime: false
    }
  ];

  const addConstraint = () => {
    if (!newConstraint.type) {
      alert('제약 조건 유형을 선택해주세요.');
      return;
    }

          // 공동 수업 제약 조건의 경우 추가 검증
      if (newConstraint.type === 'co_teaching_requirement' || newConstraint.type === 'specific_teacher_co_teaching') {
        if (!newConstraint.mainTeacher) {
          alert('주교사를 선택해주세요.');
          return;
        }
        if (newConstraint.coTeachers.length === 0) {
          alert('부교사를 최소 1명 이상 선택해주세요.');
          return;
        }
        
        // co_teaching_requirement는 시간 필수, specific_teacher_co_teaching은 시간 선택사항
        if (newConstraint.type === 'co_teaching_requirement' && (!newConstraint.day || !newConstraint.period)) {
          alert('공동 수업 시간을 선택해주세요.');
          return;
        }
      }

    // 고정수업 전용 과목 제약조건 검증
    if (newConstraint.type === 'subject_fixed_only') {
      if (!newConstraint.subjects || newConstraint.subjects.length === 0) {
        alert('고정수업 전용으로 설정할 과목을 최소 1개 이상 선택해주세요.');
        return;
      }
    }

    // 블록제 수업 제약조건 검증
    if (newConstraint.type === 'block_period_requirement') {
      if (!newConstraint.subject) {
        alert('블록제 수업을 담당할 교사를 선택해주세요.');
        return;
      }
    }

    const constraintData = {
      id: Date.now(),
      type: newConstraint.type,
      description: newConstraint.description,
      ...(newConstraint.subject && { subject: newConstraint.subject }),
      ...(newConstraint.subjects && { subjects: newConstraint.subjects }),
      ...(newConstraint.day && { day: newConstraint.day }),
      ...(newConstraint.period && { period: parseInt(newConstraint.period) }),
      ...(newConstraint.mainTeacher && { mainTeacher: newConstraint.mainTeacher }),
      ...(newConstraint.coTeachers.length > 0 && { coTeachers: newConstraint.coTeachers })
    };

    const updatedConstraints = {
      ...constraints,
      [newConstraint.priority]: [...constraints[newConstraint.priority], constraintData]
    };

    setConstraints(updatedConstraints);
    updateData('constraints', updatedConstraints);
    setNewConstraint({
      type: '',
      priority: 'must',
      subject: '',
      subjects: [],
      day: '',
      period: '',
      description: '',
      mainTeacher: '',
      coTeachers: []
    });
  };

  const removeConstraint = (priority, index) => {
    const updatedConstraints = {
      ...constraints,
      [priority]: constraints[priority].filter((_, i) => i !== index)
    };
    setConstraints(updatedConstraints);
    updateData('constraints', updatedConstraints);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) {
      return;
    }

    const [activePriority, activeIndex] = active.id.split('-');
    const [overPriority, overIndex] = over.id.split('-');
    
    if (activePriority === overPriority) {
      // 같은 섹션 내에서 순서 변경
      const items = arrayMove(
        constraints[activePriority],
        parseInt(activeIndex),
        parseInt(overIndex)
      );
      
      const updatedConstraints = {
        ...constraints,
        [activePriority]: items
      };
      setConstraints(updatedConstraints);
      updateData('constraints', updatedConstraints);
    } else {
      // 다른 섹션으로 이동
      const sourceItems = [...constraints[activePriority]];
      const targetItems = [...constraints[overPriority]];
      
      const [movedItem] = sourceItems.splice(parseInt(activeIndex), 1);
      targetItems.splice(parseInt(overIndex), 0, movedItem);
      
      const updatedConstraints = {
        ...constraints,
        [activePriority]: sourceItems,
        [overPriority]: targetItems
      };
      setConstraints(updatedConstraints);
      updateData('constraints', updatedConstraints);
    }
  };

  const getConstraintTypeName = (type) => {
    const constraintType = constraintTypes.find(ct => ct.id === type);
    return constraintType ? constraintType.name : type;
  };

  const getCurrentConstraintType = () => {
    return constraintTypes.find(ct => ct.id === newConstraint.type);
  };

    const loadDefaultConstraints = () => {
    const defaultConstraints = {
      must: [
        { id: 1, type: 'no_duplicate_teachers', description: '교사 중복 배정 금지' },
        { id: 2, type: 'no_duplicate_classes', description: '학급 중복 배정 금지' },
        { id: 3, type: 'teacher_same_class_daily_limit', description: '교사 일일 학급 중복 금지' },
        { id: 4, type: 'class_max_daily_periods', description: '학급 일일 최대 교시 수 제한' },
        { id: 5, type: 'subject_weekly_hours', description: '과목 주당 시수 고정' },
        { id: 6, type: 'space_constraint', description: '특별실 공간 제약' }
      ],
      optional: [
        { id: 7, type: 'consecutive_teaching_limit', description: '연속 수업 제한 (권장사항) - 교사 피로도 감소' },
        { id: 8, type: 'fourth_period_distribution', description: '4교시 수업 분산 제약' },
        { id: 9, type: 'class_daily_subject_once', subject: '체육', description: '체육 하루 1회 제한' }
      ]
    };
    
    if (confirm('예시 제약 조건을 불러오시겠습니까? 기존 설정이 덮어씌워집니다.')) {
      setConstraints(defaultConstraints);
      updateData('constraints', defaultConstraints);
    }
  };

  return (
    <div className="card">
      <h2>⚖️ 제약 조건 설정</h2>
      
      {/* 통계 정보 - 가로 카드 레이아웃 */}
      <div className="flex gap-4 mb-8">
        <div className="card flex-1 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-red-600 mb-1">{constraints.must.length}</h3>
              <p className="text-red-700 font-medium">필수 조건</p>
            </div>
            <div className="text-red-500 text-3xl">🚫</div>
          </div>
        </div>
        
        <div className="card flex-1 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-orange-600 mb-1">{constraints.optional.length}</h3>
              <p className="text-orange-700 font-medium">선택 조건</p>
            </div>
            <div className="text-orange-500 text-3xl">💡</div>
          </div>
        </div>
        
        <div className="card flex-1 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {constraints.must.length + constraints.optional.length}
              </h3>
              <p className="text-blue-700 font-medium">총 제약 조건</p>
            </div>
            <div className="text-blue-500 text-3xl">📊</div>
          </div>
        </div>
        
        <div className="card flex-1 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-green-600 mb-1">{constraintTypes.length}</h3>
              <p className="text-green-700 font-medium">사용 가능한 유형</p>
            </div>
            <div className="text-green-500 text-3xl">🔧</div>
          </div>
        </div>
      </div>

      {/* 새 제약 조건 추가 */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <h3>➕ 새 제약 조건 추가</h3>
        
        <div className="grid grid-2" style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label>제약 조건 유형</label>
            <select
              value={newConstraint.type}
              onChange={(e) => setNewConstraint({ ...newConstraint, type: e.target.value })}
            >
              <option value="">제약 조건 선택</option>
              {constraintTypes.map(type => {
                const desc = constraintDescriptions[type.id];
                return (
                  <option key={type.id} value={type.id}>
                    {desc?.icon || '📋'} {type.name}
                  </option>
                );
              })}
            </select>
            {getCurrentConstraintType() && (
              <small style={{ color: '#666', fontSize: '14px', marginTop: '5px', display: 'block' }}>
                {getCurrentConstraintType().description}
              </small>
            )}
          </div>

          <div className="form-group">
            <label>우선순위</label>
            <select
              value={newConstraint.priority}
              onChange={(e) => setNewConstraint({ ...newConstraint, priority: e.target.value })}
            >
              <option value="must">필수 조건 (반드시 지켜야 함)</option>
              <option value="optional">선택 조건 (가능하면 지킴)</option>
            </select>
          </div>
        </div>

        {/* 선택된 제약조건 상세 설명 */}
        {newConstraint.type && constraintDescriptions[newConstraint.type] && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start">
              <div className="text-2xl mr-3">{constraintDescriptions[newConstraint.type].icon}</div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">
                  {constraintDescriptions[newConstraint.type].title}
                </h4>
                <p className="text-blue-700 mb-3">{constraintDescriptions[newConstraint.type].description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-gray-800 mb-1">🎯 무엇을 의미하는지</h5>
                    <p className="text-gray-600">{constraintDescriptions[newConstraint.type].what}</p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-gray-800 mb-1">✅ 설정 시 결과</h5>
                    <p className="text-gray-600">{constraintDescriptions[newConstraint.type].result}</p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-gray-800 mb-1">⚠️ 설정하지 않으면</h5>
                    <p className="text-gray-600">{constraintDescriptions[newConstraint.type].ifNotSet}</p>
                  </div>
                </div>
                
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 text-sm">
                    <strong>우선순위:</strong> {
                      constraintDescriptions[newConstraint.type].priority === 'must' 
                        ? '🚫 필수 조건 - 위반 시 시간표 생성이 실패할 수 있습니다.'
                        : '💡 권장 조건 - 가능하면 지켜지지만 필요 시 무시될 수 있습니다.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 조건별 추가 설정 */}
        {getCurrentConstraintType()?.hasSubject && newConstraint.type !== 'block_period_requirement' && (
          <div className="form-group">
            <label>대상 과목</label>
            <select
              value={newConstraint.subject}
              onChange={(e) => setNewConstraint({ ...newConstraint, subject: e.target.value })}
            >
              <option value="">과목 선택</option>
              <option value="all">모든 수업에 해당</option>
              {data.subjects.map((subject, index) => (
                <option key={index} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 블록제 수업 제약조건 - 교사 선택 */}
        {newConstraint.type === 'block_period_requirement' && (
          <div className="form-group">
            <label>대상 교사</label>
            <select
              value={newConstraint.subject}
              onChange={(e) => setNewConstraint({ ...newConstraint, subject: e.target.value })}
            >
              <option value="">교사 선택</option>
              {data.teachers.map((teacher, index) => (
                <option key={index} value={teacher.name}>
                  {teacher.name} ({teacher.subjects.join(', ')})
                </option>
              ))}
            </select>
          </div>
        )}

        {getCurrentConstraintType()?.hasSubjects && (
          <div className="form-group">
            <label>고정수업 전용 과목들</label>
            <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {data.subjects.map((subject, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={newConstraint.subjects?.includes(subject.name) || false}
                      onChange={(e) => {
                        const currentSubjects = newConstraint.subjects || [];
                        if (e.target.checked) {
                          setNewConstraint({ 
                            ...newConstraint, 
                            subjects: [...currentSubjects, subject.name] 
                          });
                        } else {
                          setNewConstraint({ 
                            ...newConstraint, 
                            subjects: currentSubjects.filter(s => s !== subject.name) 
                          });
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    {subject.name}
                  </label>
                </div>
              ))}
            </div>
            {newConstraint.subjects && newConstraint.subjects.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                선택된 과목: {newConstraint.subjects.join(', ')}
              </div>
            )}
          </div>
        )}

        {getCurrentConstraintType()?.hasTime && (
          <div className="grid grid-2">
            <div className="form-group">
              <label>요일</label>
              <select
                value={newConstraint.day}
                onChange={(e) => setNewConstraint({ ...newConstraint, day: e.target.value })}
              >
                <option value="">요일 선택</option>
                {days.map(day => (
                  <option key={day} value={day}>
                    {day}요일
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>교시</label>
              <select
                value={newConstraint.period}
                onChange={(e) => setNewConstraint({ ...newConstraint, period: e.target.value })}
              >
                <option value="">교시 선택</option>
                {Array.from({ length: Math.max(...Object.values(data.base.periods_per_day)) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}교시
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 공동 수업 설정 */}
        {(newConstraint.type === 'co_teaching_requirement' || newConstraint.type === 'specific_teacher_co_teaching') && (
          <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200 mb-6">
            <h4 className="text-lg font-semibold text-blue-800 mb-4">🤝 공동 수업 설정</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 주교사 선택 */}
              <div className="form-group">
                <label className="block text-base font-semibold text-gray-700 mb-3">주교사 선택</label>
                <select
                  value={newConstraint.mainTeacher}
                  onChange={(e) => setNewConstraint({ ...newConstraint, mainTeacher: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                >
                  <option value="">주교사 선택</option>
                  {data.teachers.map((teacher, index) => (
                    <option key={index} value={teacher.name}>
                      {teacher.name} ({teacher.subjects.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* 부교사 선택 */}
              <div className="form-group">
                <label className="block text-base font-semibold text-gray-700 mb-3">부교사 후보 선택 (다중 선택 가능)</label>
                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {data.teachers
                      .filter(teacher => teacher.name !== newConstraint.mainTeacher)
                      .map((teacher, index) => (
                        <label key={index} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={newConstraint.coTeachers.includes(teacher.name)}
                            onChange={(e) => {
                              const updatedCoTeachers = e.target.checked
                                ? [...newConstraint.coTeachers, teacher.name]
                                : newConstraint.coTeachers.filter(name => name !== teacher.name);
                              setNewConstraint({ ...newConstraint, coTeachers: updatedCoTeachers });
                            }}
                            className="mr-3 w-4 h-4"
                          />
                          <span className="flex-1 font-medium">{teacher.name}</span>
                          <span className="text-sm text-gray-500">({teacher.subjects.join(', ')})</span>
                        </label>
                      ))}
                  </div>
                </div>
                {newConstraint.coTeachers.length > 0 && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                      <strong>선택된 부교사 후보:</strong> {newConstraint.coTeachers.join(', ')}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      * 선택된 부교사 후보들 중에서 골고루 배분하여 주교사와 함께 수업에 참여합니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 최대 교사 수 설정 */}
              <div className="form-group">
                <label className="block text-base font-semibold text-gray-700 mb-3">
                  한 수업당 최대 교사 수 (주교사 + 부교사 포함)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="2"
                    max="5"
                    value={newConstraint.maxTeachers}
                    onChange={(e) => setNewConstraint(prev => ({
                      ...prev,
                      maxTeachers: parseInt(e.target.value) || 2
                    }))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">명 (기본값: 2명)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  주교사 1명 + 부교사 {newConstraint.maxTeachers - 1}명까지 가능
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  * 부교사 후보가 {newConstraint.maxTeachers - 1}명보다 많아도 한 수업에는 최대 {newConstraint.maxTeachers}명만 참여합니다.
                </p>
              </div>
            </div>

            {/* 충돌 검사 결과 */}
            {newConstraint.mainTeacher && newConstraint.coTeachers.length > 0 && newConstraint.day && newConstraint.period && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h5 className="font-semibold text-yellow-800 mb-2">⚠️ 충돌 검사</h5>
                <div className="text-sm text-yellow-700">
                  {(() => {
                    const conflicts = [];
                    const allTeachers = [newConstraint.mainTeacher, ...newConstraint.coTeachers];
                    
                    // 각 교사의 수업 불가 시간 확인
                    allTeachers.forEach(teacherName => {
                      const teacher = data.teachers.find(t => t.name === teacherName);
                      if (teacher && teacher.unavailable) {
                        const isUnavailable = teacher.unavailable.some(
                          slot => slot[0] === newConstraint.day && slot[1] === parseInt(newConstraint.period)
                        );
                        if (isUnavailable) {
                          conflicts.push(`${teacherName} 교사는 ${newConstraint.day}요일 ${newConstraint.period}교시에 수업 불가`);
                        }
                      }
                    });
                    
                    if (conflicts.length > 0) {
                      return (
                        <div>
                          <p className="font-semibold mb-2">다음 충돌이 발견되었습니다:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {conflicts.map((conflict, index) => (
                              <li key={index}>{conflict}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    } else {
                      return <p className="text-green-600">✅ 충돌 없음 - 공동 수업 가능</p>;
                    }
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label>설명 (선택사항)</label>
          <input
            type="text"
            value={newConstraint.description}
            onChange={(e) => setNewConstraint({ ...newConstraint, description: e.target.value })}
            placeholder="이 제약 조건에 대한 설명을 입력하세요"
          />
        </div>
        
        <div>
          <button className="btn btn-primary" onClick={addConstraint}>
            제약 조건 추가
          </button>
          <button className="btn btn-secondary" onClick={loadDefaultConstraints}>
            예시 제약 조건 불러오기
          </button>
        </div>
      </div>

      {/* 조건 목록 - 가로 레이아웃 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6" style={{ minHeight: '400px' }}>
          {/* 필수 조건 목록 */}
          <div className="card flex-1">
            <h3 style={{ color: '#dc3545' }}>🚫 필수 조건 (Must-have)</h3>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              시간표 생성 시 반드시 지켜져야 하는 조건들입니다. 이 조건들이 충족되지 않으면 시간표 생성이 실패할 수 있습니다.
            </p>
            
            <SortableContext
              items={constraints.must.map((_, index) => `must-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              {constraints.must.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', border: '2px dashed #dc3545', borderRadius: '8px' }}>
                  <p>설정된 필수 조건이 없습니다.</p>
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>드래그하여 조건을 이동할 수 있습니다</p>
                </div>
              ) : (
                <div>
                  {constraints.must.map((constraint, index) => (
                    <SortableConstraintItem
                      key={`must-${index}`}
                      constraint={constraint}
                      index={index}
                      priority="must"
                      onRemove={removeConstraint}
                      getConstraintTypeName={getConstraintTypeName}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </div>

          {/* 선택 조건 목록 */}
          <div className="card flex-1">
            <h3 style={{ color: '#fd7e14' }}>💡 선택 조건 (Nice-to-have)</h3>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              가능하면 지켜지는 조건들입니다. 시간표 생성 시 이 조건들을 최대한 만족시키려고 노력하지만, 불가능한 경우 무시될 수 있습니다.
            </p>
            
            <SortableContext
              items={constraints.optional.map((_, index) => `optional-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              {constraints.optional.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', border: '2px dashed #fd7e14', borderRadius: '8px' }}>
                  <p>설정된 선택 조건이 없습니다.</p>
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>드래그하여 조건을 이동할 수 있습니다</p>
                </div>
              ) : (
                <div>
                  {constraints.optional.map((constraint, index) => (
                    <SortableConstraintItem
                      key={`optional-${index}`}
                      constraint={constraint}
                      index={index}
                      priority="optional"
                      onRemove={removeConstraint}
                      getConstraintTypeName={getConstraintTypeName}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </div>
        </div>
      </DndContext>

      {/* 제약 조건 유형 설명 */}
      <div className="card" style={{ backgroundColor: '#f8f9fa' }}>
        <h3>📖 제약 조건 유형 설명</h3>
        <p className="text-gray-600 mb-4">각 제약 조건에 마우스를 올리면 상세 설명을 확인할 수 있습니다.</p>
        
        <div className="space-y-6">
          {/* 🧑‍🏫 교사 관련 제약조건 */}
          <div>
            <h4 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
              <span className="text-xl mr-2">🧑‍🏫</span>
              교사 관련 제약조건
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {constraintTypes
                .filter(type => ['no_duplicate_teachers', 'teacher_same_class_daily_limit', 'teacher_consecutive_restriction', 'consecutive_teaching_limit', 'teacher_unavailable_time', 'teacher_max_daily_hours', 'teacher_subject_conflict', 'teacher_preferred_time', 'teacher_class_restriction', 'co_teaching_requirement', 'specific_teacher_co_teaching'].includes(type.id))
                .map(type => {
                  const desc = constraintDescriptions[type.id];
                  return (
                    <div key={type.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">{desc?.icon || '📋'}</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 mb-1">{desc?.title || type.name}</h5>
                          <p className="text-sm text-gray-600 mb-2">{desc?.description || type.description}</p>
                          <div className="flex items-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              desc?.priority === 'must' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {desc?.priority === 'must' ? '🚫 필수' : '💡 권장'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 🏫 학급 관련 제약조건 */}
          <div>
            <h4 className="text-lg font-semibold text-green-800 mb-3 flex items-center">
              <span className="text-xl mr-2">🏫</span>
              학급 관련 제약조건
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {constraintTypes
                .filter(type => ['no_duplicate_classes', 'class_daily_subject_limit', 'class_max_daily_periods', 'class_consecutive_subject_restriction', 'class_daily_subject_once', 'class_daily_distribution'].includes(type.id))
                .map(type => {
                  const desc = constraintDescriptions[type.id];
                  return (
                    <div key={type.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">{desc?.icon || '📋'}</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 mb-1">{desc?.title || type.name}</h5>
                          <p className="text-sm text-gray-600 mb-2">{desc?.description || type.description}</p>
                          <div className="flex items-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              desc?.priority === 'must' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {desc?.priority === 'must' ? '🚫 필수' : '💡 권장'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 📚 과목 관련 제약조건 */}
          <div>
            <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
              <span className="text-xl mr-2">📚</span>
              과목 관련 제약조건
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {constraintTypes
                .filter(type => ['subject_weekly_hours', 'subject_fixed_time', 'subject_consecutive_periods', 'subject_teacher_requirement', 'subject_fixed_only', 'subject_blocked_period', 'avoid_consecutive_subjects', 'morning_priority_subjects', 'afternoon_priority_subjects', 'max_daily_subject_hours', 'block_period_requirement'].includes(type.id))
                .map(type => {
                  const desc = constraintDescriptions[type.id];
                  return (
                    <div key={type.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">{desc?.icon || '📋'}</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 mb-1">{desc?.title || type.name}</h5>
                          <p className="text-sm text-gray-600 mb-2">{desc?.description || type.description}</p>
                          <div className="flex items-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              desc?.priority === 'must' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {desc?.priority === 'must' ? '🚫 필수' : '💡 권장'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 🧰 기타 조건 */}
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="text-xl mr-2">🧰</span>
              기타 조건
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {constraintTypes
                .filter(type => ['space_constraint', 'free_period', 'pe_concurrent_limit', 'subject_exclusive_time', 'first_last_period_limit', 'similar_subject_conflict', 'classroom_requirement', 'fourth_period_distribution'].includes(type.id))
                .map(type => {
                  const desc = constraintDescriptions[type.id];
                  return (
                    <div key={type.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">{desc?.icon || '📋'}</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 mb-1">{desc?.title || type.name}</h5>
                          <p className="text-sm text-gray-600 mb-2">{desc?.description || type.description}</p>
                          <div className="flex items-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              desc?.priority === 'must' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {desc?.priority === 'must' ? '🚫 필수' : '💡 권장'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← 이전 단계
        </button>
        <button className="btn btn-primary" onClick={nextStep}>
          다음 단계 →
        </button>
      </div>
    </div>
  );
}

export default ConstraintSettings; 