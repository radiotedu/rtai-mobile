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
import {getSongGuessQuestions, SongGuessQuestion} from '../../i18n/gameQuestions';
import {isPracticeGame} from './gameRoutes';
import {logSafeError} from '../../utils/safeLog';

const QUESTION_COUNT = 6;

const RhythmTapScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const [questions, setQuestions] = useState<SongGuessQuestion[]>(() => shuffle(getSongGuessQuestions()).slice(0, QUESTION_COUNT));
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
  const currentQuestion = questions[index];
  const score = useMemo(() => correct * 160 + Math.max(0, streak - 1) * 35, [correct, streak]);

  useEffect(() => { prepareVerifiedGameRound(game, roundIdRef.current); }, [game]);
  useEffect(() => () => { if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current); }, []);

  const submitFinalScore = async (finalScore: number) => {
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      const result: any = await submitMobileGameScore({game, score: finalScore, clientRoundId: roundIdRef.current, startedAt: startedAtRef.current});
      setAwardedXp(Number(result?.points_awarded ?? 0));
    } catch (error) {
      logSafeError('games.songGuess.submit', error);
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishGame = (finalScore: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setFinished(true);
    submitFinalScore(finalScore);
  };

  const answer = (option: string) => {
    if (selected || finished || !answerGateRef.current.tryEnter()) return;
    const isCorrect = option === currentQuestion.answer;
    const nextCorrect = isCorrect ? correct + 1 : correct;
    const nextStreak = isCorrect ? streak + 1 : 1;
    setSelected(option);
    setCorrect(nextCorrect);
    setStreak(nextStreak);
    setFeedback(isCorrect ? `${copy('games.correct')} x${nextStreak}` : copy('games.wrong'));
    if (isCorrect) Vibration.vibrate(18);

    transitionTimeoutRef.current = setTimeout(() => {
      transitionTimeoutRef.current = null;
      if (index >= questions.length - 1) {
        finishGame(nextCorrect * 160 + Math.max(0, nextStreak - 1) * 35);
        return;
      }
      setIndex(value => value + 1);
      setSelected(null);
      answerGateRef.current.release();
    }, 850);
  };

  const resetGame = () => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
    answerGateRef.current.release();
    roundIdRef.current = createClientRoundId(game);
    prepareVerifiedGameRound(game, roundIdRef.current);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    setQuestions(shuffle(getSongGuessQuestions()).slice(0, QUESTION_COUNT));
    setIndex(0); setCorrect(0); setStreak(1); setSelected(null); setFinished(false); setFeedback(null);
    setAwardedXp(0); setSubmitFailed(false); setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameShell title={copy('games.songQuiz')} subtitle={copy('games.songQuizSubtitle')} icon="album" accentColor="#FFD54A"
        score={score} progressLabel={`${copy('games.songQuestion')} ${Math.min(index + 1, questions.length)}/${questions.length}`}
        rightLabel={`${correct} ${copy('games.songCorrect')}`} onBack={() => navigation.goBack()}>
        <FeedbackToast text={feedback} />
        <ComboMeter label={copy('games.songStreak')} value={streak} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!finished ? (
            <View style={styles.stage}>
              <View style={styles.progressDots}>
                {questions.map((question, questionIndex) => <View key={`${question.answer}-${questionIndex}`} style={[styles.progressDot, questionIndex <= index && styles.progressDotActive]} />)}
              </View>
              <View style={styles.deck}>
                <View style={styles.vinylRecord}>
                  <View style={styles.vinylGroove} />
                  <View style={styles.vinylLabel}><Icon name="broadcast" size={22} color="#111" /></View>
                </View>
                <View style={styles.equalizer}>
                  {[18, 34, 48, 28, 42, 22, 38].map((height, barIndex) => <View key={barIndex} style={[styles.equalizerBar, {height}]} />)}
                </View>
              </View>
              <Text style={styles.prompt}>{copy('games.songPrompt')}</Text>
              <Text style={styles.clue}>{currentQuestion.clue}</Text>
              <View style={styles.tags}><Text style={styles.tag}>{currentQuestion.year}</Text><Text style={styles.tag}>{currentQuestion.genre}</Text></View>
              <View style={styles.options}>
                {currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = selected === option;
                  const isAnswer = option === currentQuestion.answer;
                  return (
                    <TouchableOpacity key={option} style={[styles.option, selected && isAnswer && styles.correctOption, isSelected && !isAnswer && styles.wrongOption]}
                      onPress={() => answer(option)} disabled={selected !== null || finished} activeOpacity={0.82}>
                      <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{String.fromCharCode(65 + optionIndex)}</Text></View>
                      <Text style={styles.optionText}>{option}</Text>
                      {selected && isAnswer ? <Icon name="check-circle" size={21} color={COLORS.success} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : <Text style={styles.saving}>{copy('games.saving')}</Text>}
        </ScrollView>
      </GameShell>

      <GameResultModal visible={finished} score={score} awardedXp={awardedXp} isSubmitting={isSubmitting} submitFailed={submitFailed}
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
  content: {paddingBottom: SPACING.xl},
  stage: {marginTop: SPACING.lg, padding: SPACING.md, borderRadius: 30, backgroundColor: '#191812', borderWidth: 1, borderColor: 'rgba(255,213,74,0.32)', shadowColor: '#FFD54A', shadowOpacity: 0.14, shadowRadius: 18, elevation: 6},
  progressDots: {flexDirection: 'row', gap: 6, marginBottom: SPACING.lg},
  progressDot: {flex: 1, height: 4, borderRadius: 2, backgroundColor: '#373529'},
  progressDotActive: {backgroundColor: '#FFD54A'},
  deck: {height: 126, borderRadius: 25, backgroundColor: '#252318', borderWidth: 1, borderColor: '#464125', flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, overflow: 'hidden'},
  vinylRecord: {width: 96, height: 96, borderRadius: 48, backgroundColor: '#080808', borderWidth: 8, borderColor: '#111', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 10, elevation: 8},
  vinylGroove: {position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: '#383838'},
  vinylLabel: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD54A', alignItems: 'center', justifyContent: 'center'},
  equalizer: {flex: 1, height: 62, marginLeft: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  equalizerBar: {width: 6, borderRadius: 4, backgroundColor: '#FFD54A'},
  prompt: {color: COLORS.textMuted, fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: SPACING.lg},
  clue: {color: COLORS.text, fontSize: 36, letterSpacing: 7, textAlign: 'center', marginTop: SPACING.sm},
  tags: {flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginVertical: SPACING.md},
  tag: {color: '#FBE492', fontSize: 12, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,213,74,0.10)', borderWidth: 1, borderColor: 'rgba(255,213,74,0.24)'},
  options: {gap: SPACING.sm},
  option: {minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, backgroundColor: '#24231D', borderWidth: 1, borderColor: '#3E3B2D'},
  optionLetter: {width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,213,74,0.11)', marginRight: SPACING.sm},
  optionLetterText: {color: '#FFD54A', fontSize: 13, fontWeight: '900'},
  optionText: {flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '800'},
  correctOption: {borderColor: COLORS.success, backgroundColor: 'rgba(52,199,89,0.16)'},
  wrongOption: {borderColor: COLORS.error, backgroundColor: 'rgba(255,59,48,0.14)'},
  saving: {color: COLORS.textMuted, textAlign: 'center', fontWeight: '800', marginTop: SPACING.xl},
});

export default RhythmTapScreen;
