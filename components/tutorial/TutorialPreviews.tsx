import { Fonts, PastelColors, flashcardShadow } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PhoneFrame } from './PhoneFrame';

function MiniHeader({ title }: { title: string }) {
  return (
    <View style={styles.miniHeader}>
      <MaterialIcons name="arrow-back" size={14} color={PastelColors.text} />
      <Text style={styles.miniHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function MenuCell({ icon, label, locked }: { icon: string; label: string; locked?: boolean }) {
  return (
    <View style={[styles.menuCell, locked && styles.menuCellLocked]}>
      <MaterialIcons
        name={icon as 'layers'}
        size={22}
        color={locked ? PastelColors.textSecondary : PastelColors.primary}
      />
      <Text style={[styles.menuCellLabel, locked && styles.menuCellLabelLocked]}>{label}</Text>
    </View>
  );
}

function PreviewHomeMenu({ highlight }: { highlight: string }) {
  return (
    <PhoneFrame label="우아홈">
      <View style={styles.pad}>
        <Text style={styles.greeting}>안녕하세요, 우리 아이 엄마님!</Text>
        <View style={styles.menuGrid}>
          <MenuCell icon="layers" label="우아카드\n관리" locked={highlight !== 'manage-cards'} />
          <MenuCell icon="description" label="우아기록" locked={highlight !== 'record-inbox'} />
          <MenuCell icon="mic" label="우아놀이\n(음성)" locked={highlight !== 'play-cards'} />
          <MenuCell icon="videocam" label="우아놀이\n(영상)" locked={highlight !== 'play-video'} />
          <View style={[styles.menuCell, styles.menuCellFull, highlight === 'archive' && styles.menuCellHighlight]}>
            <MaterialIcons name="library-books" size={22} color={PastelColors.primary} />
            <Text style={styles.menuCellLabel}>우아 아카이브</Text>
          </View>
        </View>
        {highlight === 'manage-cards' && <HighlightRing style={styles.ringTopLeft} />}
        {highlight === 'record-inbox' && <HighlightRing style={styles.ringTopRight} />}
        {highlight === 'play-cards' && <HighlightRing style={styles.ringMidLeft} />}
        {highlight === 'play-video' && <HighlightRing style={styles.ringMidRight} />}
        {highlight === 'archive' && <HighlightRing style={styles.ringBottom} />}
      </View>
    </PhoneFrame>
  );
}

function HighlightRing({ style }: { style: object }) {
  return <View style={[styles.highlightRing, style]} pointerEvents="none" />;
}

function PreviewManageCardsAdd() {
  return (
    <PhoneFrame label="우아카드 관리">
      <MiniHeader title="우아카드 관리" />
      <View style={styles.pad}>
        <View style={styles.addBtn}>
          <MaterialIcons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>＋ 새 단어 추가</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.cardThumb} />
          <View style={styles.cardMeta}>
            <Text style={styles.cardWord}>엄마</Text>
            <Text style={styles.cardCat}>가족/호칭</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.cardThumb} />
          <View style={styles.cardMeta}>
            <Text style={styles.cardWord}>안녕</Text>
            <Text style={styles.cardCat}>인사/표현</Text>
          </View>
        </View>
        <HighlightRing style={styles.ringAddBtn} />
      </View>
    </PhoneFrame>
  );
}

function PreviewManageCardsFilter() {
  return (
    <PhoneFrame label="우아카드 관리">
      <MiniHeader title="우아카드 관리" />
      <View style={styles.pad}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={14} color={PastelColors.textSecondary} />
          <Text style={styles.searchPlaceholder}>단어 검색</Text>
          <View style={styles.filterChip}>
            <MaterialIcons name="tune" size={12} color={PastelColors.primary} />
            <Text style={styles.filterChipText}>필터</Text>
          </View>
        </View>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>정렬: 최근 추가순</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.cardThumb} />
          <View style={styles.cardMeta}>
            <Text style={styles.cardWord}>사과</Text>
            <Text style={styles.cardCat}>과일</Text>
          </View>
        </View>
        <HighlightRing style={styles.ringSearch} />
      </View>
    </PhoneFrame>
  );
}

function PreviewRecordInboxList() {
  return (
    <PhoneFrame label="우아기록">
      <MiniHeader title="우아기록" />
      <View style={styles.pad}>
        <View style={styles.inboxRow}>
          <View style={styles.inboxIcon}>
            <MaterialIcons name="mic" size={16} color={PastelColors.primary} />
          </View>
          <View style={styles.inboxMeta}>
            <Text style={styles.cardWord}>엄마</Text>
            <Text style={styles.cardCat}>음성 · 0:12</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={PastelColors.textSecondary} />
        </View>
        <View style={styles.inboxRow}>
          <View style={styles.inboxIcon}>
            <MaterialIcons name="videocam" size={16} color={PastelColors.primary} />
          </View>
          <View style={styles.inboxMeta}>
            <Text style={styles.cardWord}>안녕</Text>
            <Text style={styles.cardCat}>영상 · 0:28</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={PastelColors.textSecondary} />
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewRecordInboxEdit() {
  return (
    <PhoneFrame label="구간 편집">
      <View style={styles.pad}>
        <Text style={styles.editTitle}>구간 편집 · 엄마</Text>
        <View style={styles.videoPreview}>
          <View style={styles.cropBox} />
          <View style={styles.cropCornerTL} />
          <View style={styles.cropCornerBR} />
        </View>
        <View style={styles.trimBar}>
          <View style={styles.trimTrack} />
          <View style={styles.trimSelection} />
        </View>
        <View style={styles.editActions}>
          <View style={styles.editBtnSecondary}>
            <Text style={styles.editBtnSecondaryText}>구간 재생</Text>
          </View>
          <View style={styles.editBtnPrimary}>
            <Text style={styles.editBtnPrimaryText}>아카이빙</Text>
          </View>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewRecordInboxArchive() {
  return (
    <PhoneFrame label="아카이빙">
      <View style={styles.pad}>
        <View style={styles.savingOverlay}>
          <MaterialIcons name="archive" size={28} color={PastelColors.primary} />
          <Text style={styles.savingText}>안전하게 아카이빙 중...</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewPlaySetup({ mode }: { mode: 'audio' | 'video' }) {
  return (
    <PhoneFrame label="놀이 설정">
      <View style={styles.pad}>
        <Text style={styles.sheetTitle}>놀이 설정</Text>
        <View style={styles.modeRow}>
          <View style={[styles.modeChip, styles.modeChipActive]}>
            <Text style={styles.modeChipActiveText}>전체 카드</Text>
          </View>
          <View style={styles.modeChip}>
            <Text style={styles.modeChipText}>단어장 선택</Text>
          </View>
        </View>
        <View style={styles.playlistItem}>
          <MaterialIcons name={mode === 'audio' ? 'mic' : 'videocam'} size={16} color={PastelColors.primary} />
          <Text style={styles.playlistLabel}>{mode === 'audio' ? '음성 놀이' : '영상 놀이'}</Text>
        </View>
        <View style={styles.startBtn}>
          <Text style={styles.startBtnText}>시작하기</Text>
        </View>
        <HighlightRing style={styles.ringStartBtn} />
      </View>
    </PhoneFrame>
  );
}

function PreviewPlayFlash() {
  return (
    <PhoneFrame label="우아놀이">
      <View style={styles.pad}>
        <View style={styles.flashcard}>
          <View style={styles.flashImage} />
          <Text style={styles.flashWord}>엄마</Text>
        </View>
        <View style={styles.flashNav}>
          <MaterialIcons name="chevron-left" size={24} color={PastelColors.textSecondary} />
          <Text style={styles.flashCount}>3 / 12</Text>
          <MaterialIcons name="chevron-right" size={24} color={PastelColors.primary} />
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewPlayAutoRecord() {
  return (
    <PhoneFrame label="자동 녹음">
      <View style={styles.pad}>
        <View style={styles.autoRecBadge}>
          <View style={styles.recDotSmall} />
          <Text style={styles.autoRecBadgeText}>녹음 중</Text>
        </View>
        <View style={styles.flashcard}>
          <View style={styles.flashImage} />
          <Text style={styles.flashWord}>엄마</Text>
        </View>
        <View style={styles.flipHintRow}>
          <Text style={styles.flipHintText}>카드 넘기기 →</Text>
          <MaterialIcons name="chevron-right" size={28} color={PastelColors.primary} />
        </View>
        <Text style={styles.autoRecCaption}>이전 카드 저장 · 새 카드 녹음 자동 시작</Text>
        <HighlightRing style={styles.ringFlipHint} />
      </View>
    </PhoneFrame>
  );
}

function PreviewPlayVideoCardOnly() {
  return (
    <PhoneFrame label="단어 카드 화면">
      <View style={styles.pad}>
        <View style={styles.autoRecBadge}>
          <MaterialIcons name="videocam" size={12} color={PastelColors.primary} />
          <View style={styles.recDotSmall} />
          <Text style={styles.autoRecBadgeText}>전면카메라 녹화 중</Text>
        </View>
        <View style={styles.flashcardLarge}>
          <View style={styles.flashImageLarge} />
          <Text style={styles.flashWordLarge}>안녕</Text>
        </View>
        <View style={styles.flipHintRow}>
          <Text style={styles.flipHintText}>화면에는 카드만 · 카메라는 자동</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewPlayVideoSave() {
  return (
    <PhoneFrame label="저장 완료">
      <View style={styles.pad}>
        <View style={styles.savedBanner}>
          <MaterialIcons name="check-circle" size={24} color={PastelColors.primary} />
          <Text style={styles.savedText}>우아기록에 저장됐어요</Text>
        </View>
        <View style={styles.inboxRow}>
          <View style={styles.inboxIcon}>
            <MaterialIcons name="videocam" size={16} color={PastelColors.primary} />
          </View>
          <View style={styles.inboxMeta}>
            <Text style={styles.cardWord}>안녕</Text>
            <Text style={styles.cardCat}>영상 · 방금</Text>
          </View>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewArchiveList() {
  return (
    <PhoneFrame label="우아 아카이브">
      <MiniHeader title="우아 아카이브" />
      <View style={styles.pad}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={14} color={PastelColors.textSecondary} />
          <Text style={styles.searchPlaceholder}>단어 검색</Text>
        </View>
        <View style={styles.archiveWord}>
          <Text style={styles.archiveWordTitle}>엄마</Text>
          <Text style={styles.archiveWordMeta}>기록 3개 · ♥ 5</Text>
        </View>
        <View style={styles.timeline}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineLine} />
          <View style={styles.timelineItem}>
            <Text style={styles.timelineDate}>6개월</Text>
            <Text style={styles.timelineLabel}>영상 0:22</Text>
          </View>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewArchivePlay() {
  return (
    <PhoneFrame label="재생">
      <View style={styles.pad}>
        <View style={styles.archivePlayer}>
          <MaterialIcons name="play-circle-filled" size={40} color={PastelColors.primary} />
        </View>
        <View style={styles.socialRow}>
          <MaterialIcons name="favorite" size={16} color={PastelColors.primary} />
          <Text style={styles.socialText}>좋아요 3</Text>
          <MaterialIcons name="chat-bubble-outline" size={16} color={PastelColors.textSecondary} />
          <Text style={styles.socialText}>댓글 2</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewArchiveDownload() {
  return (
    <PhoneFrame label="다운로드">
      <View style={styles.pad}>
        <View style={styles.downloadRow}>
          <MaterialIcons name="download" size={20} color={PastelColors.primary} />
          <Text style={styles.downloadText}>갤러리에 저장</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.downloadHint}>크롭·카드 오버레이 적용 중...</Text>
      </View>
    </PhoneFrame>
  );
}

function PreviewCommunityFeed() {
  return (
    <PhoneFrame label="커뮤니티">
      <View style={styles.pad}>
        <Text style={styles.communityTitle}>커뮤니티</Text>
        <View style={styles.communityTabRow}>
          <View style={[styles.communityTab, styles.communityTabActive]}>
            <Text style={styles.communityTabTextActive}>전체</Text>
          </View>
          <View style={styles.communityTab}>
            <Text style={styles.communityTabText}>🔥 HOT</Text>
          </View>
          <View style={styles.communityTab}>
            <Text style={styles.communityTabText}>💡 육아꿀팁</Text>
          </View>
        </View>
        <View style={styles.communityPost}>
          <Text style={styles.communityPostCat}>💡 육아꿀팁</Text>
          <Text style={styles.communityPostTitle}>첫 단어 늘리는 우리만의 방법</Text>
          <Text style={styles.communityPostMeta}>우아엄마 · 8개월 · ♥ 12</Text>
        </View>
        <View style={styles.communityPost}>
          <Text style={styles.communityPostCat}>💬 자유수다</Text>
          <Text style={styles.communityPostTitle}>오늘도 우아놀이 성공!</Text>
          <Text style={styles.communityPostMeta}>행복한아빠 · 10개월</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewCommunityCompose() {
  return (
    <PhoneFrame label="글쓰기">
      <View style={styles.pad}>
        <View style={styles.composeCategoryRow}>
          <View style={[styles.composeChip, styles.composeChipActive]}>
            <Text style={styles.composeChipActiveText}>💡 육아꿀팁</Text>
          </View>
          <View style={styles.composeChip}>
            <Text style={styles.composeChipText}>💬 자유수다</Text>
          </View>
        </View>
        <View style={styles.composeField}>
          <Text style={styles.composePlaceholder}>제목을 입력해 주세요</Text>
        </View>
        <View style={[styles.composeField, styles.composeFieldTall]}>
          <Text style={styles.composePlaceholder}>내용을 입력해 주세요</Text>
        </View>
        <View style={styles.composeFabHint}>
          <View style={styles.miniFab}>
            <Text style={styles.miniFabIcon}>✎</Text>
          </View>
          <Text style={styles.composeFabLabel}>커뮤니티 목록에서 글쓰기</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewCommunityDetail() {
  return (
    <PhoneFrame label="글 상세">
      <View style={styles.pad}>
        <Text style={styles.communityPostCat}>💡 육아꿀팁</Text>
        <Text style={styles.communityDetailTitle}>첫 단어 늘리는 우리만의 방법</Text>
        <Text style={styles.communityDetailBody} numberOfLines={3}>
          우아놀이로 매일 10분씩 하니까 자연스럽게 단어가 늘더라고요...
        </Text>
        <View style={styles.commentBox}>
          <Text style={styles.commentAuthor}>응원하는할머니</Text>
          <Text style={styles.commentText}>저도 따라 해볼게요!</Text>
        </View>
        <View style={styles.commentInputRow}>
          <View style={styles.commentInput}>
            <Text style={styles.composePlaceholder}>댓글을 남겨 보세요</Text>
          </View>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewFamilyMenu() {
  return (
    <PhoneFrame label="아이 선택 및 관리">
      <View style={styles.pad}>
        <Text style={styles.sheetTitle}>아이 선택 및 관리</Text>
        <View style={styles.babyMenuRow}>
          <View style={styles.babyMenuAvatar} />
          <Text style={styles.cardWord}>우리 아이</Text>
          <MaterialIcons name="check" size={16} color={PastelColors.primary} />
        </View>
        <View style={styles.menuDividerThin} />
        <Text style={styles.babyMenuItemText}>⚙️ 아이 프로필 수정</Text>
        <View style={styles.babyMenuItemHighlight}>
          <Text style={styles.babyMenuItemHighlightText}>👨‍👩‍👧 가족 초대 및 관리</Text>
        </View>
        <Text style={styles.babyMenuItemText}>🔗 초대 코드로 연결하기</Text>
        <HighlightRing style={styles.ringFamilyInvite} />
      </View>
    </PhoneFrame>
  );
}

function PreviewFamilyInviteCode() {
  return (
    <PhoneFrame label="가족 초대">
      <View style={styles.pad}>
        <Text style={styles.sectionLabelSmall}>초대 권한 선택</Text>
        <View style={[styles.roleCardMini, styles.roleCardMiniActive]}>
          <Text style={styles.roleEmojiMini}>👑</Text>
          <View style={styles.roleTextMini}>
            <Text style={styles.roleTitleMini}>우아마스터</Text>
            <Text style={styles.roleDescMini}>모든 관리 권한</Text>
          </View>
        </View>
        <View style={styles.roleCardMini}>
          <Text style={styles.roleEmojiMini}>👀</Text>
          <View style={styles.roleTextMini}>
            <Text style={styles.roleTitleMini}>우아팬클럽</Text>
            <Text style={styles.roleDescMini}>아카이브 열람 위주</Text>
          </View>
        </View>
        <View style={styles.issueBtnMini}>
          <Text style={styles.issueBtnMiniText}>초대 코드 발급받기</Text>
        </View>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>발급된 초대 코드</Text>
          <Text style={styles.codeValue}>A3K9M2</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

function PreviewFamilyJoin() {
  return (
    <PhoneFrame label="코드로 연결">
      <View style={styles.pad}>
        <Text style={styles.joinTitle}>초대 코드로 연결하기</Text>
        <Text style={styles.joinHint}>마스터가 보내준 6자리 코드를 입력해 주세요.</Text>
        <View style={styles.codeInputRow}>
          {['A', '3', 'K', '9', 'M', '2'].map((ch) => (
            <View key={ch} style={styles.codeCell}>
              <Text style={styles.codeCellText}>{ch}</Text>
            </View>
          ))}
        </View>
        <View style={styles.issueBtnMini}>
          <Text style={styles.issueBtnMiniText}>연결하기</Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

const PREVIEW_MAP: Record<string, () => ReactElement> = {
  'manage-cards-home': () => <PreviewHomeMenu highlight="manage-cards" />,
  'manage-cards-add': () => <PreviewManageCardsAdd />,
  'manage-cards-filter': () => <PreviewManageCardsFilter />,
  'record-inbox-list': () => <PreviewRecordInboxList />,
  'record-inbox-edit': () => <PreviewRecordInboxEdit />,
  'record-inbox-archive': () => <PreviewRecordInboxArchive />,
  'play-cards-setup': () => <PreviewPlaySetup mode="audio" />,
  'play-cards-flash': () => <PreviewPlayFlash />,
  'play-cards-auto-record': () => <PreviewPlayAutoRecord />,
  'play-video-setup': () => <PreviewHomeMenu highlight="play-video" />,
  'play-video-card-only': () => <PreviewPlayVideoCardOnly />,
  'play-video-save': () => <PreviewPlayVideoSave />,
  'archive-list': () => <PreviewArchiveList />,
  'archive-play': () => <PreviewArchivePlay />,
  'archive-download': () => <PreviewArchiveDownload />,
  'community-feed': () => <PreviewCommunityFeed />,
  'community-compose': () => <PreviewCommunityCompose />,
  'community-detail': () => <PreviewCommunityDetail />,
  'family-menu': () => <PreviewFamilyMenu />,
  'family-invite-code': () => <PreviewFamilyInviteCode />,
  'family-join': () => <PreviewFamilyJoin />,
};

type Props = { visualKey: string };

export function TutorialStepVisual({ visualKey }: Props) {
  const Preview = PREVIEW_MAP[visualKey];
  if (!Preview) {
    return (
      <View style={styles.fallback}>
        <MaterialIcons name="image" size={32} color={PastelColors.textSecondary} />
      </View>
    );
  }
  return <Preview />;
}

const styles = StyleSheet.create({
  pad: {
    padding: 12,
    gap: 8,
    position: 'relative',
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
  },
  miniHeaderTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  menuCell: {
    width: '47%',
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  menuCellFull: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  menuCellLocked: {
    opacity: 0.45,
  },
  menuCellHighlight: {
    borderColor: PastelColors.primary,
    borderWidth: 2,
  },
  menuCellLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: PastelColors.text,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
  },
  menuCellLabelLocked: {
    color: PastelColors.textSecondary,
  },
  highlightRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: PastelColors.primary,
    borderRadius: 12,
    backgroundColor: 'rgba(177,156,217,0.12)',
  },
  ringTopLeft: { top: 36, left: 10, width: '47%', height: 68 },
  ringTopRight: { top: 36, right: 10, width: '47%', height: 68 },
  ringMidLeft: { top: 110, left: 10, width: '47%', height: 68 },
  ringMidRight: { top: 110, right: 10, width: '47%', height: 68 },
  ringBottom: { bottom: 8, left: 10, right: 10, height: 44 },
  ringAddBtn: { top: 8, left: 8, right: 8, height: 36 },
  ringSearch: { top: 44, left: 8, right: 8, height: 36 },
  ringStartBtn: { bottom: 12, left: 12, right: 12, height: 36 },
  ringFlipHint: { bottom: 28, left: 12, right: 12, height: 36 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: PastelColors.primary,
    borderRadius: 10,
    paddingVertical: 8,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  cardThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: PastelColors.primaryLight,
  },
  cardMeta: { flex: 1, gap: 2 },
  cardWord: {
    fontSize: 12,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  cardCat: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 11,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  filterChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  sortRow: { paddingHorizontal: 2 },
  sortLabel: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  inboxIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: PastelColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxMeta: { flex: 1, gap: 2 },
  editTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  videoPreview: {
    height: 80,
    backgroundColor: '#111',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  cropBox: {
    position: 'absolute',
    top: 12,
    left: 28,
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cropCornerTL: {
    position: 'absolute',
    top: 10,
    left: 26,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: PastelColors.primary,
  },
  cropCornerBR: {
    position: 'absolute',
    top: 68,
    left: 84,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: PastelColors.primary,
  },
  trimBar: {
    height: 20,
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  trimTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PastelColors.border,
  },
  trimSelection: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: 0,
    bottom: 0,
    backgroundColor: PastelColors.primary,
    opacity: 0.5,
  },
  editActions: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtnSecondary: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PastelColors.primary,
    alignItems: 'center',
  },
  editBtnSecondaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  editBtnPrimary: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: PastelColors.primary,
    alignItems: 'center',
  },
  editBtnPrimaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  savingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  savingText: {
    fontSize: 12,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  modeChipActive: {
    backgroundColor: PastelColors.primaryLight,
    borderColor: PastelColors.primary,
  },
  modeChipText: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  modeChipActiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: PastelColors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  playlistLabel: {
    fontSize: 11,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  startBtn: {
    backgroundColor: PastelColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  flashcard: {
    backgroundColor: PastelColors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  flashImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: PastelColors.primaryLight,
  },
  flashWord: {
    fontSize: 18,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  flashNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  flashCount: {
    fontSize: 11,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  autoRecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E57373',
  },
  autoRecBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  flipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  flipHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  autoRecCaption: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
  },
  flashcardLarge: {
    backgroundColor: PastelColors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  flashImageLarge: {
    width: 100,
    height: 72,
    borderRadius: 8,
    backgroundColor: PastelColors.primaryLight,
  },
  flashWordLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 10,
    padding: 12,
  },
  savedText: {
    fontSize: 12,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  archiveWord: {
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  archiveWordTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  archiveWordMeta: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  timeline: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PastelColors.primary,
    marginTop: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 16,
    bottom: 0,
    width: 2,
    backgroundColor: PastelColors.border,
  },
  timelineItem: { flex: 1, gap: 2 },
  timelineDate: {
    fontSize: 10,
    fontWeight: '600',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  timelineLabel: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  archivePlayer: {
    height: 100,
    backgroundColor: '#111',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialText: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  downloadText: {
    fontSize: 12,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  progressBar: {
    height: 6,
    backgroundColor: PastelColors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    width: '65%',
    height: '100%',
    backgroundColor: PastelColors.primary,
  },
  downloadHint: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
  },
  communityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  communityTabRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  communityTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  communityTabActive: {
    backgroundColor: PastelColors.primaryLight,
    borderColor: PastelColors.primary,
  },
  communityTabText: {
    fontSize: 9,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  communityTabTextActive: {
    fontSize: 9,
    fontWeight: '700',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  communityPost: {
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  communityPostCat: {
    fontSize: 9,
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  communityPostTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  communityPostMeta: {
    fontSize: 9,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  composeCategoryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  composeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  composeChipActive: {
    backgroundColor: PastelColors.primaryLight,
    borderColor: PastelColors.primary,
  },
  composeChipText: {
    fontSize: 9,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  composeChipActiveText: {
    fontSize: 9,
    fontWeight: '600',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  composeField: {
    backgroundColor: PastelColors.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  composeFieldTall: {
    minHeight: 48,
  },
  composePlaceholder: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  composeFabHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  miniFab: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PastelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniFabIcon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  composeFabLabel: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  communityDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  communityDetailBody: {
    fontSize: 10,
    lineHeight: 16,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  commentBox: {
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  commentAuthor: {
    fontSize: 9,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  commentText: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  commentInputRow: {
    marginTop: 4,
  },
  commentInput: {
    backgroundColor: PastelColors.surface,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  babyMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  babyMenuAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PastelColors.primaryLight,
  },
  menuDividerThin: {
    height: 1,
    backgroundColor: PastelColors.border,
    marginVertical: 6,
  },
  babyMenuItemText: {
    fontSize: 11,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    paddingVertical: 6,
  },
  babyMenuItemHighlight: {
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  babyMenuItemHighlightText: {
    fontSize: 11,
    fontWeight: '700',
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  ringFamilyInvite: {
    top: 72,
    left: 8,
    right: 8,
    height: 32,
  },
  sectionLabelSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  roleCardMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  roleCardMiniActive: {
    borderColor: PastelColors.primary,
    backgroundColor: PastelColors.primaryLight,
  },
  roleEmojiMini: {
    fontSize: 16,
  },
  roleTextMini: {
    flex: 1,
    gap: 1,
  },
  roleTitleMini: {
    fontSize: 11,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  roleDescMini: {
    fontSize: 9,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  issueBtnMini: {
    backgroundColor: PastelColors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  issueBtnMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  codeBox: {
    backgroundColor: PastelColors.surface,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  codeLabel: {
    fontSize: 9,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  codeValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: PastelColors.primary,
    fontFamily: Fonts.rounded,
  },
  joinTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  joinHint: {
    fontSize: 10,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  codeInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  codeCell: {
    width: 28,
    height: 36,
    borderRadius: 8,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellText: {
    fontSize: 14,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  fallback: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 12,
  },
});
