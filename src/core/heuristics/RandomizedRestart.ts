// Randomized Restart (랜덤 재시작)

import { TimetableState } from './types';
import { TimetableData } from '../constraints/types';

export interface RestartConfig {
  maxDepth: number; // 최대 탐색 깊이
  maxRestarts: number; // 최대 재시작 횟수
  seed?: number; // 랜덤 시드
}

export class RandomizedRestart {
  private config: RestartConfig;
  private currentRestarts = 0;
  private randomSeed: number;

  constructor(config: RestartConfig) {
    this.config = config;
    this.randomSeed = config.seed || Date.now();
  }

  /**
   * 재시작이 필요한지 확인
   */
  shouldRestart(state: TimetableState): boolean {
    // 백트래킹 횟수가 너무 많거나 깊이가 너무 깊으면 재시작
    if (state.backtrackCount > this.config.maxDepth) {
      return true;
    }

    // 미배정 변수가 없는데도 완료되지 않으면 재시작
    if (state.unassigned.length === 0 && state.iteration > 0) {
      return true;
    }

    return false;
  }

  /**
   * 재시작 가능 여부 확인
   */
  canRestart(): boolean {
    return this.currentRestarts < this.config.maxRestarts;
  }

  /**
   * 상태 초기화 (랜덤 시드로 재시작)
   */
  resetState(initialState: TimetableState): TimetableState {
    this.currentRestarts++;
    this.randomSeed = (this.randomSeed * 1103515245 + 12345) & 0x7fffffff; // LCG

    // 랜덤 시드로 변수 순서 섞기
    const shuffled = [...initialState.unassigned];
    this.shuffleArray(shuffled, this.randomSeed);

    return {
      ...initialState,
      unassigned: shuffled,
      iteration: 0,
      backtrackCount: 0,
      assignments: [],
    };
  }

  /**
   * 배열 섞기 (Fisher-Yates with seed)
   */
  private shuffleArray<T>(array: T[], seed: number): void {
    let random = seed;
    for (let i = array.length - 1; i > 0; i--) {
      random = (random * 1103515245 + 12345) & 0x7fffffff;
      const j = Math.floor((random / 0x7fffffff) * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 현재 재시작 횟수
   */
  getRestartCount(): number {
    return this.currentRestarts;
  }

  /**
   * 재시작 설정 업데이트
   */
  updateConfig(config: Partial<RestartConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
