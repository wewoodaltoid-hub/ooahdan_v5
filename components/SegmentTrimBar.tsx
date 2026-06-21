import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { PastelColors, Fonts } from '@/constants/theme';

const TRACK_HEIGHT = 44;
const LINE_THICKNESS = 5;
const SELECTION_LINE_THICKNESS = 7;
const HANDLE_WIDTH = 22;
const HANDLE_HIT_WIDTH = 36;

type Props = {
  durationSec: number;
  startSec: number;
  endSec: number;
  onChangeStart: (sec: number) => void;
  onChangeEnd: (sec: number) => void;
  onDragStart?: () => void;
  onDragComplete?: () => void;
  minGapSec?: number;
  stepSec?: number;
  /** false면 트랙을 컨테이너 전체 너비에 맞춤 (양쪽 라벨 사이 flex 영역용) */
  insetTrack?: boolean;
  /** false면 하단 시간 텍스트 숨김 (바깥에서 별도 표시) */
  showTimeMeta?: boolean;
};

function roundToStep(v: number, step: number) {
  return Math.round(v / step) * step;
}

function formatTimePrecise(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const secStr = s.toFixed(2);
  return m > 0 ? `${m}:${secStr}` : `${secStr}초`;
}

/** 전체 타임라인 위에서 시작·끝 핸들로 재생 구간을 조절하는 트림 바 */
export function SegmentTrimBar({
  durationSec,
  startSec,
  endSec,
  onChangeStart,
  onChangeEnd,
  onDragStart,
  onDragComplete,
  minGapSec = 0.1,
  stepSec = 0.05,
  insetTrack = true,
  showTimeMeta = true,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);

  const trackWidthRef = useRef(0);
  const durationRef = useRef(durationSec);
  const startRef = useRef(startSec);
  const endRef = useRef(endSec);
  const dragOriginRef = useRef(0);
  const onChangeStartRef = useRef(onChangeStart);
  const onChangeEndRef = useRef(onChangeEnd);
  const onDragStartRef = useRef(onDragStart);
  const onDragCompleteRef = useRef(onDragComplete);
  const minGapRef = useRef(minGapSec);
  const stepRef = useRef(stepSec);

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);

  useEffect(() => {
    durationRef.current = durationSec;
    startRef.current = startSec;
    endRef.current = endSec;
    onChangeStartRef.current = onChangeStart;
    onChangeEndRef.current = onChangeEnd;
    onDragStartRef.current = onDragStart;
    onDragCompleteRef.current = onDragComplete;
    minGapRef.current = minGapSec;
    stepRef.current = stepSec;
  }, [
    durationSec,
    startSec,
    endSec,
    onChangeStart,
    onChangeEnd,
    onDragStart,
    onDragComplete,
    minGapSec,
    stepSec,
  ]);

  const startHandlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragOriginRef.current = startRef.current;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_, g) => {
        const w = trackWidthRef.current;
        const dur = durationRef.current;
        if (w <= 0 || dur <= 0) return;
        const delta = (g.dx / w) * dur;
        const minGap = minGapRef.current;
        const step = stepRef.current;
        const next = roundToStep(dragOriginRef.current + delta, step);
        const maxStart = Math.max(0, endRef.current - minGap);
        onChangeStartRef.current(Math.max(0, Math.min(maxStart, next)));
      },
      onPanResponderRelease: () => onDragCompleteRef.current?.(),
      onPanResponderTerminate: () => onDragCompleteRef.current?.(),
    }),
  ).current;

  const endHandlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragOriginRef.current = endRef.current;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_, g) => {
        const w = trackWidthRef.current;
        const dur = durationRef.current;
        if (w <= 0 || dur <= 0) return;
        const delta = (g.dx / w) * dur;
        const minGap = minGapRef.current;
        const step = stepRef.current;
        const next = roundToStep(dragOriginRef.current + delta, step);
        const minEnd = Math.min(dur, startRef.current + minGap);
        onChangeEndRef.current(Math.max(minEnd, Math.min(dur, next)));
      },
      onPanResponderRelease: () => onDragCompleteRef.current?.(),
      onPanResponderTerminate: () => onDragCompleteRef.current?.(),
    }),
  ).current;

  const start = Math.max(0, Math.min(startSec, endSec - minGapSec));
  const end = Math.min(durationSec, Math.max(endSec, startSec + minGapSec));
  const leftPct = durationSec > 0 ? (start / durationSec) * 100 : 0;
  const widthPct = durationSec > 0 ? ((end - start) / durationSec) * 100 : 100;
  const selectionSec = Math.max(0, end - start);
  const lineTop = (TRACK_HEIGHT - LINE_THICKNESS) / 2;
  const selectionLineTop = (TRACK_HEIGHT - SELECTION_LINE_THICKNESS) / 2;
  const trackSideInset = insetTrack ? HANDLE_HIT_WIDTH / 2 : 0;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.trackWrap}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View
          pointerEvents="none"
          style={[
            styles.baseLine,
            { top: lineTop, height: LINE_THICKNESS, left: trackSideInset, right: trackSideInset },
          ]}
        />

        {durationSec > 0 && (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.selectionLine,
                {
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: selectionLineTop,
                  height: SELECTION_LINE_THICKNESS,
                },
              ]}
            />

            <View
              style={[styles.handleHit, { left: `${leftPct}%`, marginLeft: -HANDLE_HIT_WIDTH / 2 }]}
              {...startHandlePan.panHandlers}
            >
              <View style={styles.handle}>
                <View style={styles.handleGrip} />
              </View>
            </View>

            <View
              style={[
                styles.handleHit,
                { left: `${leftPct + widthPct}%`, marginLeft: -HANDLE_HIT_WIDTH / 2 },
              ]}
              {...endHandlePan.panHandlers}
            >
              <View style={styles.handle}>
                <View style={styles.handleGrip} />
              </View>
            </View>
          </>
        )}
      </View>

      {showTimeMeta && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>
            재생 구간 {formatTimePrecise(start)} ~ {formatTimePrecise(end)}
          </Text>
          <Text style={styles.timeMeta}>
            {formatTimePrecise(selectionSec)} / 전체 {formatTimePrecise(durationSec)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 0,
  },
  trackWrap: {
    height: TRACK_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
  },
  baseLine: {
    position: 'absolute',
    borderRadius: LINE_THICKNESS / 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  selectionLine: {
    position: 'absolute',
    borderRadius: SELECTION_LINE_THICKNESS / 2,
    backgroundColor: PastelColors.segmentHighlight,
  },
  handleHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_HIT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: TRACK_HEIGHT - 8,
    borderRadius: 8,
    backgroundColor: PastelColors.surface,
    borderWidth: 2,
    borderColor: PastelColors.segmentHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B19CD9',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  handleGrip: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: PastelColors.segmentHighlight,
  },
  timeRow: {
    marginTop: 8,
    gap: 2,
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  timeMeta: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
});
