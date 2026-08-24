import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {gameListCopy} from '../../i18n/gameListCopy';
import {isPracticeGame} from './gameRoutes';
import {logSafeError} from '../../utils/safeLog';

type Point = {x: number; y: number};
type Direction = 'up' | 'down' | 'left' | 'right';

const BOARD_SIZE = 14;
const START_SNAKE: Point[] = [{x: 6, y: 7}, {x: 5, y: 7}, {x: 4, y: 7}];

const SnakeScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = useCallback((key: string) => appCopy(i18n.language, key), [i18n.language]);
  const localizedGame = gameListCopy('snake', i18n.language);
  const [snake, setSnake] = useState<Point[]>(START_SNAKE);
  const [food, setFood] = useState<Point>(() => createFood(START_SNAKE));
  const [direction, setDirection] = useState<Direction>('right');
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [awardedXp, setAwardedXp] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const directionRef = useRef<Direction>('right');
  const scoreRef = useRef(0);
  const comboRef = useRef(1);
  const submittedRef = useRef(false);
  const roundIdRef = useRef('');
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  const submitFinalScore = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      const result: any = await submitMobileGameScore({
        game,
        score: scoreRef.current,
        clientRoundId: roundIdRef.current,
        startedAt: startedAtRef.current,
      });
      setAwardedXp(Number(result?.points_awarded ?? 0));
    } catch (error) {
      logSafeError('games.snake.submit', error);
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [game]);

  const finishGame = useCallback(() => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    setRunning(false);
    setGameOver(true);
    setFeedback(copy('games.roundFinished'));
    Vibration.vibrate([0, 50, 70, 50]);
    submitFinalScore();
  }, [copy, submitFinalScore]);

  useEffect(() => {
    if (!running || gameOver) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSnake((current) => {
        const head = current[0];
        const nextHead = getNextHead(head, directionRef.current);
        const bodyWithoutTail = current.slice(0, -1);

        if (
          nextHead.x < 0 ||
          nextHead.y < 0 ||
          nextHead.x >= BOARD_SIZE ||
          nextHead.y >= BOARD_SIZE ||
          bodyWithoutTail.some((part) => samePoint(part, nextHead))
        ) {
          finishGame();
          return current;
        }

        const ateFood = samePoint(nextHead, food);
        const nextSnake = ateFood ? [nextHead, ...current] : [nextHead, ...current.slice(0, -1)];
        if (ateFood) {
          const nextCombo = Math.min(comboRef.current + 1, 9);
          const gained = 8 + nextCombo * 3;
          const nextScore = scoreRef.current + gained;
          comboRef.current = nextCombo;
          scoreRef.current = nextScore;
          setCombo(nextCombo);
          setScore(nextScore);
          setFeedback(`+${gained}  x${nextCombo}`);
          Vibration.vibrate(18);
          setFood(createFood(nextSnake));
        }

        return nextSnake;
      });
    }, Math.max(120, 245 - scoreRef.current / 10));

    return () => clearInterval(timer);
  }, [finishGame, food, gameOver, running]);

  const resetGame = () => {
    const nextSnake = START_SNAKE;
    roundIdRef.current = '';
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    scoreRef.current = 0;
    comboRef.current = 1;
    setAwardedXp(0);
    setIsSubmitting(false);
    setSubmitFailed(false);
    setScore(0);
    setCombo(1);
    setDirection('right');
    setSnake(nextSnake);
    setFood(createFood(nextSnake));
    setGameOver(false);
    setRunning(false);
  };

  const toggleRunning = () => {
    if (gameOver) {
      return;
    }
    if (!roundIdRef.current) {
      roundIdRef.current = createClientRoundId(game);
      startedAtRef.current = Date.now();
      prepareVerifiedGameRound(game, roundIdRef.current);
    }
    setRunning(value => !value);
  };

  const setSafeDirection = (next: Direction) => {
    const current = directionRef.current;
    if (
      (current === 'up' && next === 'down') ||
      (current === 'down' && next === 'up') ||
      (current === 'left' && next === 'right') ||
      (current === 'right' && next === 'left')
    ) {
      return;
    }

    setDirection(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameShell
        title={localizedGame.title}
        subtitle={localizedGame.description}
        icon="snake"
        accentColor="#48E08A"
        score={score}
        progressLabel={`${snake.length} ${copy('games.snakeLength')}`}
        rightLabel={running ? copy('games.snakeRight') : copy('games.snakeStopped')}
        onBack={() => navigation.goBack()}>
        <FeedbackToast text={feedback} />
        <ComboMeter label={copy('games.snakeCombo')} value={combo} />

        <View style={styles.board}>
          {Array.from({length: BOARD_SIZE}).map((_, y) => (
            <View key={y} style={styles.row}>
              {Array.from({length: BOARD_SIZE}).map((__, x) => {
                const isSnake = snake.some((part) => part.x === x && part.y === y);
                const isHead = snake[0]?.x === x && snake[0]?.y === y;
                const isFood = food.x === x && food.y === y;
                return (
                  <View
                    key={`${x}-${y}`}
                    style={[
                      styles.cell,
                      isSnake && styles.snakeCell,
                      isHead && styles.snakeHead,
                      isFood && styles.foodCell,
                    ]}>
                    {isHead ? <View style={styles.snakeEye} /> : null}
                    {isFood ? <Icon name="music-note-eighth" size={13} color="#07150C" /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.controls}>
          <ControlButton icon="arrow-left-bold" label={copy('games.rhythmLeft')} onPress={() => setSafeDirection('left')} />
          <ControlButton icon="arrow-up-bold" label={copy('games.snakeUp')} onPress={() => setSafeDirection('up')} />
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={toggleRunning}
            disabled={gameOver}
            accessibilityRole="button"
            accessibilityLabel={copy(running ? 'games.pause' : 'games.resume')}>
            <Icon name={running ? 'pause' : 'play'} size={26} color="#fff" />
          </TouchableOpacity>
          <ControlButton icon="arrow-down-bold" label={copy('games.snakeDown')} onPress={() => setSafeDirection('down')} />
          <ControlButton icon="arrow-right-bold" label={copy('games.rhythmRight')} onPress={() => setSafeDirection('right')} />
        </View>

        <Text style={styles.helpText}>{copy('games.snakeHelp')}</Text>
      </GameShell>

      <GameResultModal
        visible={gameOver}
        score={score}
        awardedXp={awardedXp}
        isSubmitting={isSubmitting}
        submitFailed={submitFailed}
        practice={isPracticeGame(game)}
        onRetrySubmit={submitFinalScore}
        onRestart={resetGame}
        onExit={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
};

function ControlButton({icon, label, onPress}: {icon: string; label: string; onPress: () => void}) {
  return (
    <TouchableOpacity
      style={styles.controlButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon name={icon} size={28} color={COLORS.text} />
    </TouchableOpacity>
  );
}

function getNextHead(head: Point, direction: Direction): Point {
  if (direction === 'up') {
    return {x: head.x, y: head.y - 1};
  }
  if (direction === 'down') {
    return {x: head.x, y: head.y + 1};
  }
  if (direction === 'left') {
    return {x: head.x - 1, y: head.y};
  }
  return {x: head.x + 1, y: head.y};
}

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function createFood(snake: Point[]): Point {
  const available: Point[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) {
        available.push({x, y});
      }
    }
  }

  return available[Math.floor(Math.random() * available.length)] || {x: 0, y: 0};
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  board: {alignSelf: 'center', marginTop: SPACING.lg, padding: 6, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(72,224,138,0.48)', backgroundColor: '#0D1511', shadowColor: '#48E08A', shadowOpacity: 0.2, shadowRadius: 18, elevation: 8},
  row: {flexDirection: 'row'},
  cell: {width: 22, height: 22, margin: 0.5, borderRadius: 5, backgroundColor: '#111C16', borderWidth: 0.5, borderColor: '#1B2A21', alignItems: 'center', justifyContent: 'center'},
  snakeCell: {backgroundColor: '#26B96B', borderColor: '#67F0A4'},
  snakeHead: {backgroundColor: '#B8FF74', borderColor: '#E4FFC8'},
  snakeEye: {width: 5, height: 5, borderRadius: 3, backgroundColor: '#0B2B18'},
  foodCell: {backgroundColor: '#FFD54A', borderColor: '#FFF0A3', transform: [{scale: 0.86}]},
  controls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, gap: 6},
  controlButton: {width: 54, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17221B', borderWidth: 1, borderColor: 'rgba(72,224,138,0.28)'},
  pauseButton: {width: 56, height: 52, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26B96B', shadowColor: '#48E08A', shadowOpacity: 0.32, shadowRadius: 10, elevation: 6},
  helpText: {color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: SPACING.md},
});

export default SnakeScreen;
