/**
 * 유저(보호자·아이) 정보 전역 상태
 */

import { create } from 'zustand';

export type GuardianGender = 'male' | 'female';

type UserState = {
  childName: string;
  setChildName: (name: string) => void;
  /** 보호자 이름(닉네임) — 회원가입 시 입력, 프로필에서 수정 */
  userName: string;
  setUserName: (name: string) => void;
  /** 보호자 성별 — 메인 인사말 엄마/아빠 표시용 */
  guardianGender: GuardianGender;
  setGuardianGender: (gender: GuardianGender) => void;
};

export const useUserStore = create<UserState>((set) => ({
  childName: '우리 아이',
  setChildName: (name) => set({ childName: name ?? '' }),
  userName: '',
  setUserName: (name) => set({ userName: name ?? '' }),
  guardianGender: 'male',
  setGuardianGender: (gender) => set({ guardianGender: gender }),
}));

/** 성별에 따른 호칭 (엄마/아빠) */
export function guardianTitle(gender: GuardianGender): string {
  return gender === 'female' ? '엄마' : '아빠';
}

/** 이름 + 주어 조사 '(이)가' — 받침 있으면 '이', 없으면 '가' */
export function childNameWithSubject(name: string): string {
  if (!name.length) return name;
  const last = name.charCodeAt(name.length - 1);
  const hasJongseong = (last - 0xac00) % 28 !== 0;
  return name + (hasJongseong ? '이' : '가');
}
