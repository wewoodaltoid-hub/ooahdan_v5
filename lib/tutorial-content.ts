import type { ComponentProps } from 'react';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type TutorialIconName = ComponentProps<typeof MaterialIcons>['name'];

export type TutorialStep = {
  title: string;
  description: string;
  /** TutorialPreviews 컴포넌트 키 */
  visual: string;
};

export type TutorialSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: TutorialIconName;
  masterOnly?: boolean;
  route?: string;
  steps: TutorialStep[];
};

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: 'manage-cards',
    title: '우아카드 관리',
    subtitle: '단어 카드 추가·편집·정리',
    icon: 'layers',
    masterOnly: true,
    route: '/manage-cards',
    steps: [
      {
        title: '우아홈에서 진입',
        description: '우아홈 메뉴에서 「우아카드 관리」를 누르면 단어 카드 목록이 열려요.',
        visual: 'manage-cards-home',
      },
      {
        title: '단어 추가하기',
        description: '＋ 새 단어 추가로 단어·카테고리·사진을 등록할 수 있어요. 사진은 갤러리에서 고를 수 있어요.',
        visual: 'manage-cards-add',
      },
      {
        title: '검색·필터·정렬',
        description: '상단 검색창과 필터로 상태·카테고리별로 찾고, 정렬 기준도 바꿀 수 있어요.',
        visual: 'manage-cards-filter',
      },
    ],
  },
  {
    id: 'record-inbox',
    title: '우아기록',
    subtitle: '녹음·녹화 후 구간 편집',
    icon: 'description',
    masterOnly: true,
    route: '/record-inbox',
    steps: [
      {
        title: '녹화가 쌓이는 곳',
        description:
          '우아놀이(음성·영상) 중 만들어진 모든 녹음·영상 파일이 우아기록에 임시로 모여요. 단어별로 확인할 수 있어요.\n\n' +
          '아직 아카이빙하지 않은 기록은 임시 저장 상태이며, 2시간이 지나면 자동으로 삭제돼요. 소중한 순간은 꼭 아카이빙으로 남겨 주세요.',
        visual: 'record-inbox-list',
      },
      {
        title: '구간·크롭 편집',
        description:
          '항목을 탭하면 편집 화면이 열려요. 재생 구간(시작·끝)으로 저장하고 싶은 부분만 잘라내고, 영상은 1:1 크롭으로 담을 영역만 골라요. ' +
          '구간과 화면을 마음에 들게 맞춘 뒤에만 아카이빙하면 돼요.',
        visual: 'record-inbox-edit',
      },
      {
        title: '아카이빙',
        description: '편집이 끝나면 아카이빙으로 확정 저장해요. 저장된 기록은 우아 아카이브에서 볼 수 있어요.',
        visual: 'record-inbox-archive',
      },
    ],
  },
  {
    id: 'play-cards',
    title: '우아놀이 (음성)',
    subtitle: '플래시카드 + 음성 녹음',
    icon: 'mic',
    masterOnly: true,
    route: '/play-cards',
    steps: [
      {
        title: '놀이 설정',
        description: '우아홈에서 우아놀이(음성)를 고르고, 전체 카드 또는 단어장을 선택한 뒤 시작해요.',
        visual: 'play-cards-setup',
      },
      {
        title: '카드 넘기기',
        description: '화면의 카드를 보며 아이와 함께 단어를 연습해요. 좌우로 넘기며 진행할 수 있어요.',
        visual: 'play-cards-flash',
      },
      {
        title: '자동 녹음',
        description:
          '녹음 버튼을 따로 누를 필요가 없어요. 카드가 보이는 동안 자동으로 녹음이 진행되고, 카드를 넘기면 이전 카드 녹음이 끝나며 우아기록에 저장돼요. ' +
          '새 카드로 넘어가면 곧바로 다음 카드 녹음이 자동으로 시작돼요.',
        visual: 'play-cards-auto-record',
      },
    ],
  },
  {
    id: 'play-cards-video',
    title: '우아놀이 (영상)',
    subtitle: '영상 촬영 + 단어 카드',
    icon: 'videocam',
    masterOnly: true,
    route: '/play-cards-video',
    steps: [
      {
        title: '영상 놀이 시작',
        description: '우아홈에서 우아놀이(영상)를 선택하고 단어장을 고른 뒤 카메라 권한을 허용해요.',
        visual: 'play-video-setup',
      },
      {
        title: '단어 카드 화면',
        description:
          '화면에는 단어 카드만 보여요. 전면 카메라는 화면 밖에서 자동으로 돌아가며, 카드가 보이는 동안 녹화가 진행돼요. ' +
          '카드를 넘기면 이전 카드 영상이 저장되고, 새 카드 녹화가 자동으로 시작돼요.',
        visual: 'play-video-card-only',
      },
      {
        title: '자동 저장',
        description:
          '녹화된 영상은 우아기록에 임시 저장돼요. 카드당 최대 60초까지 녹화할 수 있어요. 마음에 드는 구간만 편집한 뒤 아카이빙해 주세요.',
        visual: 'play-video-save',
      },
    ],
  },
  {
    id: 'archive',
    title: '우아 아카이브',
    subtitle: '확정된 성장 기록 모음',
    icon: 'library-books',
    route: '/archive',
    steps: [
      {
        title: '단어별 타임라인',
        description: '아카이빙된 녹음·영상이 단어별로 정리돼요. 검색으로 빠르게 찾을 수 있어요.',
        visual: 'archive-list',
      },
      {
        title: '재생·댓글·좋아요',
        description: '기록을 눌러 재생하고, 가족이 댓글과 좋아요를 남길 수 있어요.',
        visual: 'archive-play',
      },
      {
        title: '영상 다운로드',
        description: '영상 기록은 갤러리로 저장할 수 있어요. 크롭·카드 오버레이가 적용된 영상이 만들어져요.',
        visual: 'archive-download',
      },
    ],
  },
  {
    id: 'community',
    title: '커뮤니티',
    subtitle: '육아 이야기·꿀팁 나누기',
    icon: 'forum',
    route: '/(tabs)/community',
    steps: [
      {
        title: '하단 탭에서 진입',
        description:
          '하단 메뉴의 「커뮤니티」 탭에서 다른 부모님들의 글을 볼 수 있어요. 전체·HOT·육아꿀팁·자유수다 탭으로 분류해서 둘러볼 수 있어요.',
        visual: 'community-feed',
      },
      {
        title: '글쓰기·검색·북마크',
        description:
          '오른쪽 아래 ✎ 버튼으로 글을 작성할 수 있어요. 제목·본문·사진·카테고리를 넣을 수 있고, 검색과 📋 내 활동으로 내 글·댓글 단 글을 모아볼 수 있어요. 북마크로 나중에 다시 찾을 수도 있어요.',
        visual: 'community-compose',
      },
      {
        title: '댓글로 소통',
        description:
          '글을 탭하면 상세 화면이 열려요. 댓글로 이야기를 나누고, 커뮤니티 닉네임은 상단에서 설정할 수 있어요.',
        visual: 'community-detail',
      },
    ],
  },
  {
    id: 'family-invite',
    title: '가족 초대 및 관리',
    subtitle: '마스터·팬클럽 초대와 연결',
    icon: 'people',
    route: '/family-invite',
    steps: [
      {
        title: '우아홈에서 진입',
        description:
          '우아홈 상단의 아이 이름을 탭하면 「아이 선택 및 관리」 메뉴가 열려요. 마스터는 「👨‍👩‍👧 가족 초대 및 관리」에서 초대 코드를 발급할 수 있어요.',
        visual: 'family-menu',
      },
      {
        title: '권한 선택·코드 발급',
        description:
          '초대할 가족의 권한을 선택해요. 「우아마스터」는 단어·아카이브 등 모든 관리 권한, 「우아팬클럽」은 아카이브 열람 위주예요. 6자리 초대 코드를 발급받아 복사해 공유하면 돼요. 코드는 24시간 동안 유효해요.',
        visual: 'family-invite-code',
      },
      {
        title: '초대받은 가족 연결',
        description:
          '초대받은 가족은 같은 메뉴에서 「🔗 초대 코드로 연결하기」를 선택하고 6자리 코드를 입력하면 아이 프로필에 연결돼요.',
        visual: 'family-join',
      },
    ],
  },
];

export function getTutorialSection(id: string): TutorialSection | undefined {
  return TUTORIAL_SECTIONS.find((s) => s.id === id);
}
