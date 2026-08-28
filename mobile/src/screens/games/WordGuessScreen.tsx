import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import {appCopy} from '../../i18n/appCopy';
import {getWordGuessQuestions, WordGuessQuestion} from '../../i18n/gameQuestions';
import {ArcadeGame} from '../../services/gamificationService';
import {COLORS, SPACING} from '../../theme/theme';
import {logSafeError} from '../../utils/safeLog';
import {FeedbackToast, GameResultModal, GameShell} from './GameChrome';
import {isPracticeGame} from './gameRoutes';
import {createClientRoundId, prepareVerifiedGameRound, submitMobileGameScore} from './gameSession';

const ROUND_SIZE = 12;
const QUESTION_SECONDS = 15;
const STARTING_LIVES = 3;
const TIMEOUT_MARKER = '__timeout__';

const WordGuessScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = useCallback((key: string) => appCopy(i18n.language, key), [i18n.language]);
  const createRound = useCallback(
    () => shuffle(getWordGuessQuestions(i18n.language)).slice(0, ROUND_SIZE),
    [i18n.language],
  );
  const [questions, setQuestions] = useState<WordGuessQuestion[]>(createRound);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [awardedGold, setAwardedGold] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const submittedRef = useRef(false);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundIdRef = useRef(createClientRoundId(game));
  const startedAtRef = useRef(Date.now());
  const currentQuestion = questions[index];

  useEffect(() => prepareVerifiedGameRound(game, roundIdRef.current), [game]);
  useEffect(() => () => {
    if (transitionRef.current) clearTimeout(transitionRef.current);
  }, []);

  const submitFinalScore = useCallback(async (finalScore: number) => {
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      const result: any = await submitMobileGameScore({game, score: finalScore, clientRoundId: roundIdRef.current, startedAt: startedAtRef.current});
      setAwardedGold(Number(result?.points_awarded ?? 0));
    } catch (error) {
      logSafeError('games.wordGuess.submit', error);
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [game]);

  const finishGame = useCallback((finalScore: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setFinished(true);
    void submitFinalScore(finalScore);
  }, [submitFinalScore]);

  const resolveAnswer = useCallback((option: string) => {
    if (selected || finished || !currentQuestion) return;
    const timedOut = option === TIMEOUT_MARKER;
    const isCorrect = !timedOut && option === currentQuestion.answer;
    const nextLives = isCorrect ? lives : Math.max(0, lives - 1);
    const nextStreak = isCorrect ? streak + 1 : 0;
    const gained = isCorrect ? 100 + timeLeft * 8 + nextStreak * 20 : 0;
    const nextScore = score + gained;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    setSelected(option);
    setLives(nextLives);
    setStreak(nextStreak);
    setScore(nextScore);
    setCorrect(nextCorrect);
    setFeedback(isCorrect ? `+${gained} · ${copy('games.correct')}` : timedOut ? copy('games.timeUp') : copy('games.wrong'));
    if (isCorrect) Vibration.vibrate(18);
    transitionRef.current = setTimeout(() => {
      transitionRef.current = null;
      if (index >= questions.length - 1 || nextLives === 0) {
        finishGame(nextScore);
        return;
      }
      setIndex(value => value + 1);
      setSelected(null);
      setTimeLeft(QUESTION_SECONDS);
    }, 900);
  }, [copy, correct, currentQuestion, finishGame, finished, index, lives, questions.length, score, selected, streak, timeLeft]);

  useEffect(() => {
    if (finished || selected || !currentQuestion) return undefined;
    if (timeLeft <= 0) {
      resolveAnswer(TIMEOUT_MARKER);
      return undefined;
    }
    const timer = setTimeout(() => setTimeLeft(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [currentQuestion, finished, resolveAnswer, selected, timeLeft]);

  const resetGame = () => {
    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = null;
    roundIdRef.current = createClientRoundId(game);
    prepareVerifiedGameRound(game, roundIdRef.current);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    setQuestions(createRound());
    setIndex(0); setScore(0); setCorrect(0); setStreak(0); setLives(STARTING_LIVES);
    setTimeLeft(QUESTION_SECONDS); setSelected(null); setFinished(false); setFeedback(null);
    setAwardedGold(0); setSubmitFailed(false); setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameShell title={copy('games.word')} subtitle={copy('games.wordSubtitle')} icon="music-circle-outline" accentColor="#FF7043"
        score={score} progressLabel={`${Math.min(index + 1, questions.length)}/${questions.length}`}
        rightLabel={`${correct} ${copy('games.wordCorrect')}`} onBack={() => navigation.goBack()}>
        <FeedbackToast text={feedback} />
        <View style={styles.statusRow}>
          <View style={styles.lives}>
            {Array.from({length: STARTING_LIVES}).map((_, lifeIndex) => (
              <Icon key={lifeIndex} name={lifeIndex < lives ? 'heart' : 'heart-outline'} size={22} color={lifeIndex < lives ? '#FF5C6C' : '#5D4549'} />
            ))}
          </View>
          <View style={styles.streakPill}><Icon name="fire" size={17} color="#FFD166" /><Text style={styles.streakText}>x{Math.max(1, streak)}</Text></View>
          <View style={styles.timerPill}><Icon name="timer-outline" size={17} color={timeLeft <= 5 ? '#FF5C6C' : '#FFB199'} /><Text style={[styles.timerText, timeLeft <= 5 && styles.timerDanger]}>{timeLeft}</Text></View>
        </View>
        <View style={styles.timerTrack}><View style={[styles.timerFill, {width: `${(timeLeft / QUESTION_SECONDS) * 100}%`}]} /></View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!finished && currentQuestion ? (
            <View style={styles.stage}>
              <View style={styles.categoryRow}>
                <View style={styles.categoryIcon}><Icon name="radio-tower" size={22} color="#FF7043" /></View>
                <View><Text style={styles.category}>RadioTEDU Music IQ</Text><Text style={styles.poolCount}>256 {copy('games.questionPool')}</Text></View>
              </View>
              <Text style={styles.prompt}>{currentQuestion.prompt}</Text>
              <View style={styles.options}>
                {currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = selected === option;
                  const isAnswer = option === currentQuestion.answer;
                  return (
                    <TouchableOpacity key={option} style={[styles.option, selected && isAnswer && styles.correctOption, isSelected && !isAnswer && styles.wrongOption]}
                      onPress={() => resolveAnswer(option)} disabled={selected !== null} activeOpacity={0.82}>
                      <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{String.fromCharCode(65 + optionIndex)}</Text></View>
                      <Text style={styles.optionText}>{option}</Text>
                      {selected && isAnswer ? <Icon name="check-circle" size={21} color={COLORS.success} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </GameShell>
      <GameResultModal visible={finished} score={score} awardedXp={awardedGold} isSubmitting={isSubmitting} submitFailed={submitFailed}
        practice={isPracticeGame(game)} onRetrySubmit={() => submitFinalScore(score)} onRestart={resetGame} onExit={() => navigation.goBack()} />
    </SafeAreaView>
  );
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, gap: SPACING.sm},
  lives: {flex: 1, flexDirection: 'row', gap: 5},
  streakPill: {height: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,209,102,0.10)', borderWidth: 1, borderColor: 'rgba(255,209,102,0.24)'},
  streakText: {color: '#FFD166', fontWeight: '900'},
  timerPill: {height: 36, minWidth: 60, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(255,112,67,0.10)', borderWidth: 1, borderColor: 'rgba(255,112,67,0.30)'},
  timerText: {color: '#FFB199', fontSize: 16, fontWeight: '900'},
  timerDanger: {color: '#FF5C6C'},
  timerTrack: {height: 5, borderRadius: 3, backgroundColor: '#35211D', overflow: 'hidden', marginTop: SPACING.sm},
  timerFill: {height: '100%', backgroundColor: '#FF7043'},
  content: {paddingBottom: SPACING.xl},
  stage: {marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: 30, backgroundColor: '#1D1513', borderWidth: 1, borderColor: 'rgba(255,112,67,0.34)', shadowColor: '#FF7043', shadowOpacity: 0.16, shadowRadius: 18, elevation: 7},
  categoryRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  categoryIcon: {width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,112,67,0.12)', borderWidth: 1, borderColor: 'rgba(255,112,67,0.32)'},
  category: {color: '#FFB199', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase'},
  poolCount: {color: COLORS.textMuted, fontSize: 11, marginTop: 2},
  prompt: {color: COLORS.text, fontSize: 25, fontWeight: '900', lineHeight: 33, marginVertical: SPACING.xl},
  options: {gap: SPACING.sm},
  option: {minHeight: 60, borderRadius: 19, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, backgroundColor: '#29201E', borderWidth: 1, borderColor: '#493631'},
  optionLetter: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,112,67,0.12)', marginRight: SPACING.sm},
  optionLetterText: {color: '#FFB199', fontSize: 13, fontWeight: '900'},
  optionText: {flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '800'},
  correctOption: {borderColor: COLORS.success, backgroundColor: 'rgba(52,199,89,0.16)'},
  wrongOption: {borderColor: COLORS.error, backgroundColor: 'rgba(255,59,48,0.14)'},
});

export default WordGuessScreen;
