import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, Vibration, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation, useRoute} from '@react-navigation/native';
import {COLORS, SPACING} from '../../theme/theme';
import {ArcadeGame} from '../../services/gamificationService';
import {createClientRoundId, prepareVerifiedGameRound, submitMobileGameScore} from './gameSession';
import {ComboMeter, FeedbackToast, GameResultModal, GameShell} from './GameChrome';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../../i18n/appCopy';
import {isPracticeGame} from './gameRoutes';
import {logSafeError} from '../../utils/safeLog';

const TOTAL_BEATS = 28;
const LANE_COLORS = ['#46C8FF', '#FFD54A', '#FF6B8A'];

const RhythmTapScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const lanes = [copy('games.rhythmLeft'), copy('games.rhythmCenter'), copy('games.rhythmRight')];
  const [activeLane, setActiveLane] = useState(1);
  const [beat, setBeat] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [awardedXp, setAwardedXp] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const submittedRef = useRef(false);
  const roundIdRef = useRef(createClientRoundId(game));
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    prepareVerifiedGameRound(game, roundIdRef.current);
  }, [game]);
  const beatStartedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!running || finished) {
      return undefined;
    }

    const timer = setInterval(() => {
      setMisses((value) => value + 1);
      streakRef.current = 0;
      setStreak(0);
      setFeedback(copy('games.miss'));
      advanceBeat();
    }, 1100);

    return () => clearInterval(timer);
  });

  const submitFinalScore = async (finalScore = scoreRef.current) => {
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      const result: any = await submitMobileGameScore({
        game,
        score: finalScore,
        clientRoundId: roundIdRef.current,
        startedAt: startedAtRef.current,
      });
      setAwardedXp(Number(result?.points_awarded ?? 0));
    } catch (error) {
      logSafeError('games.rhythm.submit', error);
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceBeat = () => {
    setBeat((current) => {
      if (current >= TOTAL_BEATS) {
        finishGame();
        return current;
      }
      beatStartedAtRef.current = Date.now();
      setActiveLane(Math.floor(Math.random() * lanes.length));
      return current + 1;
    });
  };

  const handleTap = (laneIndex: number) => {
    if (!running || finished) {
      return;
    }

    if (laneIndex === activeLane) {
      const latency = Date.now() - beatStartedAtRef.current;
      const isPerfect = latency < 420;
      const judgement = isPerfect ? copy('games.perfect') : copy('games.good');
      const nextStreak = streakRef.current + 1;
      const gained = isPerfect ? 42 + nextStreak * 4 : 28 + nextStreak * 3;
      const nextScore = scoreRef.current + gained;
      scoreRef.current = nextScore;
      streakRef.current = nextStreak;
      setScore(nextScore);
      setStreak(nextStreak);
      setFeedback(`${judgement} +${gained}`);
      Vibration.vibrate(isPerfect ? 12 : 20);
    } else {
      setMisses((value) => value + 1);
      streakRef.current = 0;
      setStreak(0);
      setFeedback(copy('games.wrongLane'));
    }

    advanceBeat();
  };

  const finishGame = () => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    setRunning(false);
    setFinished(true);
    submitFinalScore(scoreRef.current);
  };

  const resetGame = () => {
    roundIdRef.current = createClientRoundId(game);
    prepareVerifiedGameRound(game, roundIdRef.current);
    startedAtRef.current = Date.now();
    beatStartedAtRef.current = Date.now();
    submittedRef.current = false;
    scoreRef.current = 0;
    streakRef.current = 0;
    setScore(0);
    setBeat(1);
    setMisses(0);
    setStreak(0);
    setActiveLane(1);
    setFinished(false);
    setRunning(true);
    setAwardedXp(0);
    setSubmitFailed(false);
    setIsSubmitting(false);
    setFeedback(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameShell
        title={copy('games.rhythm')}
        subtitle={copy('games.rhythmSubtitle')}
        icon="music-circle-outline"
        accentColor="#FFD54A"
        score={score}
        progressLabel={`${beat}/${TOTAL_BEATS}`}
        rightLabel={`${misses} ${copy('games.rhythmMisses')}`}
        onBack={() => navigation.goBack()}>
        <FeedbackToast text={feedback} />
        <ComboMeter label={copy('games.rhythmCombo')} value={Math.max(1, streak)} />

        <View style={styles.laneRow}>
          {lanes.map((lane, index) => (
            <TouchableOpacity
              key={lane}
              style={[
                styles.lane,
                {borderColor: `${LANE_COLORS[index]}55`, backgroundColor: `${LANE_COLORS[index]}12`},
                activeLane === index && {backgroundColor: LANE_COLORS[index], borderColor: '#FFFFFF'},
              ]}
              onPress={() => handleTap(index)}
              activeOpacity={0.78}>
              <View style={[styles.laneRail, {backgroundColor: `${LANE_COLORS[index]}44`}]} />
              <Icon name={activeLane === index ? 'music-note-eighth' : 'circle-outline'} size={38} color={activeLane === index ? '#111' : LANE_COLORS[index]} />
              <Text style={[styles.laneText, activeLane === index && styles.activeLaneText]}>{lane}</Text>
              <View style={[styles.targetRing, {borderColor: activeLane === index ? '#111' : LANE_COLORS[index]}]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.pauseButton} onPress={() => setRunning((value) => !value)} disabled={finished}>
          <Icon name={running ? 'pause' : 'play'} size={22} color="#fff" />
          <Text style={styles.pauseText}>{running ? copy('games.pause') : copy('games.resume')}</Text>
        </TouchableOpacity>
      </GameShell>

      <GameResultModal
        visible={finished}
        score={score}
        awardedXp={awardedXp}
        isSubmitting={isSubmitting}
        submitFailed={submitFailed}
        practice={isPracticeGame(game)}
        onRetrySubmit={() => submitFinalScore(score)}
        onRestart={resetGame}
        onExit={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  laneRow: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl},
  lane: {flex: 1, height: 250, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5},
  laneRail: {position: 'absolute', width: 3, top: 24, bottom: 24, borderRadius: 2},
  targetRing: {position: 'absolute', bottom: 24, width: 28, height: 28, borderRadius: 14, borderWidth: 3, backgroundColor: 'rgba(0,0,0,0.18)'},
  laneText: {color: COLORS.textMuted, fontSize: 15, fontWeight: '900', marginTop: SPACING.sm},
  activeLaneText: {color: '#111'},
  pauseButton: {height: 52, borderRadius: 18, flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B69012', marginTop: SPACING.lg, shadowColor: '#FFD54A', shadowOpacity: 0.25, shadowRadius: 10, elevation: 5},
  pauseText: {color: '#fff', fontSize: 14, fontWeight: '900'},
});

export default RhythmTapScreen;
