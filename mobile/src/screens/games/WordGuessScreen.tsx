import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation, useRoute} from '@react-navigation/native';
import {COLORS, SPACING} from '../../theme/theme';
import {ArcadeGame} from '../../services/gamificationService';
import {createClientRoundId, prepareVerifiedGameRound, submitMobileGameScore} from './gameSession';
import {ComboMeter, FeedbackToast, GameResultModal, GameShell} from './GameChrome';
import {createAnswerGate} from './answerGate';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../../i18n/appCopy';
import {getWordGuessQuestions, WordGuessQuestion} from '../../i18n/gameQuestions';
import {isPracticeGame} from './gameRoutes';
import {logSafeError} from '../../utils/safeLog';

const WordGuessScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const [questions, setQuestions] = useState<WordGuessQuestion[]>(() => shuffle(getWordGuessQuestions(i18n.language)).slice(0, 6));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [awardedXp, setAwardedXp] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const submittedRef = useRef(false);
  const answerGateRef = useRef(createAnswerGate());
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundIdRef = useRef(createClientRoundId(game));
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    prepareVerifiedGameRound(game, roundIdRef.current);
  }, [game]);

  const currentQuestion = questions[index];
  const score = useMemo(() => correct * 120 + Math.max(0, streak - 1) * 25, [correct, streak]);

  useEffect(() => () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
  }, []);

  const submitFinalScore = async (finalScore: number) => {
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
      logSafeError('games.wordGuess.submit', error);
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const answer = (option: string) => {
    if (selected || finished || !answerGateRef.current.tryEnter()) {
      return;
    }

    const isCorrect = option === currentQuestion.answer;
    setSelected(option);
    let nextCorrect = correct;
    let nextStreak = streak;
    if (isCorrect) {
      nextCorrect += 1;
      nextStreak += 1;
      setFeedback(`${copy('games.correct')} x${nextStreak}`);
      Vibration.vibrate(18);
    } else {
      nextStreak = 1;
      setFeedback(copy('games.wrong'));
    }
    setCorrect(nextCorrect);
    setStreak(nextStreak);

    transitionTimeoutRef.current = setTimeout(() => {
      transitionTimeoutRef.current = null;
      if (index >= questions.length - 1) {
        const finalScore = nextCorrect * 120 + Math.max(0, nextStreak - 1) * 25;
        finishGame(finalScore);
        return;
      }

      setIndex((value) => value + 1);
      setSelected(null);
      answerGateRef.current.release();
    }, 760);
  };

  const finishGame = (finalScore: number) => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    setFinished(true);
    submitFinalScore(finalScore);
  };

  const resetGame = () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    answerGateRef.current.release();
    roundIdRef.current = createClientRoundId(game);
    prepareVerifiedGameRound(game, roundIdRef.current);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    setQuestions(shuffle(getWordGuessQuestions(i18n.language)).slice(0, 6));
    setIndex(0);
    setCorrect(0);
    setStreak(1);
    setSelected(null);
    setFinished(false);
    setAwardedXp(0);
    setSubmitFailed(false);
    setIsSubmitting(false);
    setFeedback(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameShell
        title={copy('games.word')}
        subtitle={copy('games.wordSubtitle')}
        icon="head-question-outline"
        accentColor="#FF8A4C"
        score={score}
        progressLabel={`${copy('games.wordQuestion')} ${Math.min(index + 1, questions.length)}/${questions.length}`}
        rightLabel={`${correct} ${copy('games.wordCorrect')}`}
        onBack={() => navigation.goBack()}>
        <FeedbackToast text={feedback} />
        <ComboMeter label={copy('games.wordStreak')} value={streak} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!finished ? (
            <View style={styles.questionCard}>
              <View style={styles.progressDots}>
                {questions.map((question, questionIndex) => (
                  <View
                    key={`${question.prompt}-${questionIndex}`}
                    style={[styles.progressDot, questionIndex <= index && styles.progressDotActive]}
                  />
                ))}
              </View>
              <View style={styles.questionIcon}>
                <Icon name="head-question-outline" size={34} color="#FF8A4C" />
              </View>
              <Text style={styles.prompt}>{currentQuestion.prompt}</Text>
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = selected === option;
                const isAnswer = option === currentQuestion.answer;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.option,
                      selected && isAnswer && styles.correctOption,
                      isSelected && !isAnswer && styles.wrongOption,
                    ]}
                    onPress={() => answer(option)}
                    disabled={selected !== null || finished}
                    activeOpacity={0.82}>
                    <View style={styles.optionLetter}>
                      <Text style={styles.optionLetterText}>{String.fromCharCode(65 + optionIndex)}</Text>
                    </View>
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.waitCard}>
              <Text style={styles.waitText}>{copy('games.saving')}</Text>
            </View>
          )}
        </ScrollView>
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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {paddingBottom: SPACING.xl},
  questionCard: {marginTop: SPACING.lg, padding: SPACING.md, borderRadius: 28, backgroundColor: '#1C1715', borderWidth: 1, borderColor: 'rgba(255,138,76,0.32)', shadowColor: '#FF8A4C', shadowOpacity: 0.12, shadowRadius: 16, elevation: 6},
  progressDots: {flexDirection: 'row', gap: 6, marginBottom: SPACING.md},
  progressDot: {flex: 1, height: 4, borderRadius: 2, backgroundColor: '#3A302B'},
  progressDotActive: {backgroundColor: '#FF8A4C'},
  questionIcon: {width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,138,76,0.10)', borderWidth: 1, borderColor: 'rgba(255,138,76,0.28)'},
  prompt: {color: COLORS.text, fontSize: 23, fontWeight: '900', lineHeight: 30, marginVertical: SPACING.lg},
  option: {minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, backgroundColor: '#231F1D', borderWidth: 1, borderColor: '#3A332F', marginBottom: SPACING.sm},
  optionLetter: {width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,138,76,0.10)', marginRight: SPACING.sm},
  optionLetterText: {color: '#FFAA7C', fontSize: 13, fontWeight: '900'},
  correctOption: {borderColor: COLORS.success, backgroundColor: 'rgba(52,199,89,0.16)'},
  wrongOption: {borderColor: COLORS.error, backgroundColor: 'rgba(255,59,48,0.14)'},
  optionText: {flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '800'},
  waitCard: {padding: SPACING.lg, borderRadius: 24, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.lg},
  waitText: {color: COLORS.textMuted, textAlign: 'center', fontWeight: '800'},
});

export default WordGuessScreen;
