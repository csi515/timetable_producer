import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TimetableEntry } from '../../types/timetable';
import { Subject } from '../../types/subject';
import { Teacher } from '../../types/teacher';
import { AdPlaceholder } from '../Ads/AdPlaceholder';
import { useTimetableStore } from '../../store/timetableStore';

interface TimetableGridProps {
  entries: TimetableEntry[];
  subjects: Subject[];
  teachers: Teacher[];
  classId: string;
  days: string[];
  maxPeriods: number;
}

// Draggable Component
const DraggableEntry = ({ entry, subjectName, teacherName, isOverlay = false }: {
  entry: TimetableEntry;
  subjectName: string;
  teacherName: string;
  isOverlay?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entry }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex flex-col h-full justify-center items-center text-center gap-1 w-full p-1 rounded ${isOverlay ? 'bg-white shadow-lg border border-blue-500' : ''}`}
    >
      <div className="font-bold text-gray-900 text-sm">{subjectName}</div>
      <div className="text-xs text-gray-500">{teacherName}</div>
      {entry.isBlockClass && (
        <div className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">블록</div>
      )}
      {entry.roomId && (
        <div className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">{entry.roomId}</div>
      )}
    </div>
  );
};

// Droppable Component
const DroppableCell = ({ day, period, children, isValid, violationMessage }: {
  day: string;
  period: number;
  children: React.ReactNode;
  isValid?: boolean;
  violationMessage?: string;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${day}-${period}`,
    data: { day, period }
  });

  let bgClass = '';
  if (isOver) {
    bgClass = isValid ? 'bg-blue-50' : 'bg-red-50';
  } else {
    bgClass = 'hover:bg-gray-50';
  }

  return (
    <td
      ref={setNodeRef}
      className={`border border-gray-200 p-2 h-24 align-top transition-colors ${bgClass} relative group`}
    >
      {children}
      {isOver && !isValid && violationMessage && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-100 text-red-600 text-[10px] p-1 text-center font-bold z-10">
          {violationMessage}
        </div>
      )}
    </td>
  );
};

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  entries,
  subjects,
  teachers,
  classId,
  days,
  maxPeriods
}) => {
  const swapEntries = useTimetableStore((state) => state.swapEntries);
  const updateEntry = useTimetableStore((state) => state.updateEntry);
  const [activeEntry, setActiveEntry] = useState<TimetableEntry | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // useMemo로 entries를 Map으로 변환하여 O(1) 조회 성능 개선
  const entriesMap = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    entries.forEach(entry => {
      if (entry.classId === classId) {
        const key = `${entry.day}-${entry.period}`;
        map.set(key, entry);
      }
    });
    return map;
  }, [entries, classId]);

  const getEntry = (day: string, period: number): TimetableEntry | undefined => {
    return entriesMap.get(`${day}-${period}`);
  };

  const getSubjectName = (subjectId: string): string => {
    return subjects.find(s => s.id === subjectId)?.name || subjectId;
  };

  const getTeacherName = (teacherId: string): string => {
    return teachers.find(t => t.id === teacherId)?.name || teacherId;
  };

  const checkConstraint = (entry: TimetableEntry, day: string, period: number): { isValid: boolean; message?: string } => {
    // 1. 교사 불가능 시간 체크
    const entryTeacherIds = entry.teacherIds || [entry.teacherId];
    for (const teacherId of entryTeacherIds) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) {
        const isUnavailable = teacher.unavailableTimes.some(
          ut => ut.day === day && ut.period === period
        );
        if (isUnavailable) {
          return { isValid: false, message: `${teacher.name} 교사 불가 시간` };
        }
      }
    }

    // 2. 교사 중복 체크 (다른 반 수업)
    // 현재 교시(day, period)에 해당 교사가 다른 반 수업이 있는지 확인
    // 단, 현재 이동하려는 entry 자체는 제외해야 함 (이미 배정된 상태라면)
    // 또한, swap의 경우 targetEntry가 있다면 targetEntry의 교사가 activeEntry의 원래 위치로 가는 것도 체크해야 하지만,
    // 여기서는 activeEntry가 target 위치로 가는 것만 체크 (단순화)

    for (const teacherId of entryTeacherIds) {
      const conflict = entries.find(e =>
        e.day === day &&
        e.period === period &&
        e.classId !== classId && // 다른 반 수업만 체크 (같은 반은 어차피 덮어쓰거나 스왑)
        (e.teacherIds ? e.teacherIds.includes(teacherId) : e.teacherId === teacherId)
      );

      if (conflict) {
        const conflictClass = conflict.classId; // 학급명 정보가 없어서 ID 출력 (개선 가능)
        return { isValid: false, message: `${conflictClass} 수업 중복` };
      }
    }

    return { isValid: true };
  };

  const handleDragStart = (event: any) => {
    setActiveEntry(event.active.data.current.entry);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEntry(null);

    if (!over) return;

    const activeEntry = active.data.current?.entry as TimetableEntry;
    const overData = over.data.current as { day: string; period: number } | undefined;

    if (!activeEntry || !overData) return;

    // Check constraints before moving
    const validation = checkConstraint(activeEntry, overData.day, overData.period);
    if (!validation.isValid) {
      if (!confirm(`제약 조건 위반: ${validation.message}\n그래도 이동하시겠습니까?`)) {
        return;
      }
    }

    // Check if dropping on another entry or empty cell
    const targetEntry = getEntry(overData.day, overData.period);

    if (targetEntry) {
      // Swap
      if (targetEntry.id !== activeEntry.id) {
        // 블록 수업 체크
        if (activeEntry.isBlockClass || targetEntry.isBlockClass) {
          if (!confirm('블록 수업을 이동하면 연속성이 깨질 수 있습니다. 계속하시겠습니까?')) {
            return;
          }
        }
        swapEntries(activeEntry.id, targetEntry.id);
      }
    } else {
      // Move to empty cell
      if (activeEntry.isBlockClass) {
        if (!confirm('블록 수업을 이동하면 연속성이 깨질 수 있습니다. 계속하시겠습니까?')) {
          return;
        }
      }

      // Update entry with new day and period
      const updatedEntry = {
        ...activeEntry,
        day: overData.day,
        period: overData.period
      };
      updateEntry(updatedEntry);
    }
  };

  const [activeDay, setActiveDay] = React.useState(days[0]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="timetable-container">
        {/* Mobile View (No DnD for now) */}
        <div className="md:hidden">
          <div className="flex overflow-x-auto mb-4 bg-white rounded-lg border border-gray-200 p-1">
            {days.map(day => (
              <button
                key={day}
                className={`flex-1 py-2 px-4 text-sm font-semibold rounded-md transition-colors ${activeDay === day
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
                  }`}
                onClick={() => setActiveDay(day)}
              >
                {day}요일
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => {
              const entry = getEntry(activeDay, period);
              return (
                <div key={period} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                    {period}
                  </div>
                  <div className="flex-1">
                    {entry ? (
                      <div>
                        <div className="font-bold text-gray-900 text-lg">{getSubjectName(entry.subjectId)}</div>
                        <div className="text-gray-600 text-sm mt-1">
                          {entry.teacherIds
                            ? entry.teacherIds.map(id => getTeacherName(id)).join(', ')
                            : getTeacherName(entry.teacherId)}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {entry.isBlockClass && entry.blockStartPeriod === period && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">블록</span>
                          )}
                          {entry.roomId && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">{entry.roomId}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic">수업 없음</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop View (With DnD) */}
        <div className="hidden md:block timetable-grid overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-gray-50 border border-gray-200 p-3 text-gray-600 font-semibold w-20">교시</th>
                {days.map(day => (
                  <th key={day} className="bg-gray-50 border border-gray-200 p-3 text-gray-900 font-semibold">{day}요일</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => (
                <tr key={period}>
                  <td className="border border-gray-200 p-3 text-center font-semibold text-gray-600 bg-gray-50">{period}</td>
                  {days.map(day => {
                    const entry = getEntry(day, period);
                    const validation = activeEntry ? checkConstraint(activeEntry, day, period) : { isValid: true };

                    return (
                      <DroppableCell
                        key={`${day}-${period}`}
                        day={day}
                        period={period}
                        isValid={validation.isValid}
                        violationMessage={validation.message}
                      >
                        {entry ? (
                          <DraggableEntry
                            entry={entry}
                            subjectName={getSubjectName(entry.subjectId)}
                            teacherName={entry.teacherIds
                              ? entry.teacherIds.map(id => getTeacherName(id)).join(', ')
                              : getTeacherName(entry.teacherId)}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-300">-</div>
                        )}
                      </DroppableCell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {activeEntry ? (
            <DraggableEntry
              entry={activeEntry}
              subjectName={getSubjectName(activeEntry.subjectId)}
              teacherName={activeEntry.teacherIds
                ? activeEntry.teacherIds.map(id => getTeacherName(id)).join(', ')
                : getTeacherName(activeEntry.teacherId)}
              isOverlay
            />
          ) : null}
        </DragOverlay>

        <div className="mt-6 flex justify-center">
          <AdPlaceholder type="banner" />
        </div>
      </div>
    </DndContext>
  );
};

