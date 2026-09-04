import React, {useCallback, useEffect, useRef, useState} from 'react';
import {PanResponder, StyleSheet, Text, TouchableOpacity, Vibration, View} from 'react-native';
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
const INITIAL_OBSTACLES = createObstacles(START_SNAKE, 4);
const INITIAL_FOOD = createFood([...START_SNAKE, ...INITIAL_OBSTACLES]);

const SnakeScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = useCallback((key: string) => appCopy(i18n.language, key), [i18n.language]);
  const localizedGame = gameListCopy('snake', i18n.language);
  const [cellSize, setCellSize] = useState(1);
  const [snake, setSnake] = useState<Point[]>(START_SNAKE);
  const [food, setFood] = useState<Point>(INITIAL_FOOD);
  const [obstacles, setObstacles] = useState<Point[]>(INITIAL_OBSTACLES);
  const [goldenNote, setGoldenNote] = useState(false);
  const [lives, setLives] = useState(3);
  const [notesCollected, setNotesCollected] = useState(0);
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
  const livesRef = useRef(3);
  const notesRef = useRef(0);
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
          bodyWithoutTail.some((part) => samePoint(part, nextHead)) ||
          obstacles.some((part) => samePoint(part, nextHead))
        ) {
          const nextLives = livesRef.current - 1;
          livesRef.current = nextLives;
          setLives(nextLives);
          setCombo(1);
          comboRef.current = 1;
          if (nextLives <= 0) {
            finishGame();
            return current;
          }
          directionRef.current = 'right';
          setDirection('right');
          setFeedback(`♥ ${nextLives}`);
          Vibration.vibrate([0, 60, 50, 60]);
          return START_SNAKE;
        }

        const ateFood = samePoint(nextHead, food);
        const nextSnake = ateFood ? [nextHead, ...current] : [nextHead, ...current.slice(0, -1)];
        if (ateFood) {
          const nextCombo = Math.min(comboRef.current + 1, 9);
          const gained = (goldenNote ? 28 : 10) + nextCombo * 4;
          const nextScore = scoreRef.current + gained;
          const nextNotes = notesRef.current + 1;
          comboRef.current = nextCombo;
          scoreRef.current = nextScore;
          notesRef.current = nextNotes;
          setCombo(nextCombo);
          setScore(nextScore);
          setNotesCollected(nextNotes);
          setFeedback(`+${gained}  x${nextCombo}`);
          Vibration.vibrate(18);
          let nextObstacles = obstacles;
          if (nextNotes % 4 === 0) {
            nextObstacles = [
              ...obstacles,
              ...createObstacles([...START_SNAKE, ...nextSnake, ...obstacles], 1),
            ];
            setObstacles(nextObstacles);
          }
          setGoldenNote(Math.random() < 0.22);
          setFood(createFood([...nextSnake, ...nextObstacles]));
        }

        return nextSnake;
      });
    }, Math.max(120, 245 - scoreRef.current / 10));

    return () => clearInterval(timer);
  }, [finishGame, food, gameOver, goldenNote, obstacles, running]);

  const resetGame = () => {
    const nextSnake = START_SNAKE;
    roundIdRef.current = '';
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    scoreRef.current = 0;
    comboRef.current = 1;
    livesRef.current = 3;
    notesRef.current = 0;
    setAwardedXp(0);
    setIsSubmitting(false);
    setSubmitFailed(false);
    setScore(0);
    setCombo(1);
    setLives(3);
    setNotesCollected(0);
    setDirection('right');
    setSnake(nextSnake);
    const nextObstacles = createObstacles(nextSnake, 4);
    setObstacles(nextObstacles);
    setFood(createFood([...nextSnake, ...nextObstacles]));
    setGoldenNote(false);
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

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        setSafeDirection(gesture.dx > 0 ? 'right' : 'left');
      } else {
        setSafeDirection(gesture.dy > 0 ? 'down' : 'up');
      }
    },
  });

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

        <View style={styles.missionRow}>
          <View style={styles.lifePill}>
            {Array.from({length: 3}).map((_, index) => (
              <Icon key={index} name={index < lives ? 'heart' : 'heart-outline'} size={18} color={index < lives ? '#FF5C6C' : '#5D4549'} />
            ))}
          </View>
          <View style={styles.notePill}><Icon name="music-note" size={18} color="#FFD54A" /><Text style={styles.noteCount}>{notesCollected}</Text></View>
          <Text style={styles.swipeHint}>SWIPE</Text>
        </View>

        <View style={styles.boardArea} onLayout={({nativeEvent: {layout}}) => {
          // Reserve the controls' natural height; fit the board into what remains.
          setCellSize(Math.max(1, Math.min(22, (Math.min(layout.width, layout.height) - 14) / BOARD_SIZE - 1)));
        }}>
        <View style={styles.board} {...panResponder.panHandlers}>
          {Array.from({length: BOARD_SIZE}).map((_, y) => (
            <View key={y} style={styles.row}>
              {Array.from({length: BOARD_SIZE}).map((__, x) => {
                const isSnake = snake.some((part) => part.x === x && part.y === y);
                const isHead = snake[0]?.x === x && snake[0]?.y === y;
                const isFood = food.x === x && food.y === y;
                const isObstacle = obstacles.some((part) => part.x === x && part.y === y);
                return (
                  <View
                    key={`${x}-${y}`}
                    style={[
                      styles.cell,
                      {width: cellSize, height: cellSize},
                      isSnake && styles.snakeCell,
                      isHead && styles.snakeHead,
                      isFood && styles.foodCell,
                      goldenNote && isFood && styles.goldenFoodCell,
                      isObstacle && styles.obstacleCell,
                    ]}>
                    {isHead ? <View style={styles.snakeEye} /> : null}
                    {isFood ? <Icon name={goldenNote ? 'star-four-points' : 'music-note-eighth'} size={13} color="#07150C" /> : null}
                    {isObstacle ? <View style={styles.obstacleCore} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.dpadTop}>
            <ControlButton icon="arrow-up-bold" label={copy('games.snakeUp')} onPress={() => setSafeDirection('up')} />
          </View>
          <View style={styles.dpadMiddle}>
            <ControlButton icon="arrow-left-bold" label={copy('games.rhythmLeft')} onPress={() => setSafeDirection('left')} />
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={toggleRunning}
              disabled={gameOver}
              accessibilityRole="button"
              accessibilityLabel={copy(running ? 'games.pause' : 'games.resume')}>
              <Icon name={running ? 'pause' : 'play'} size={26} color="#fff" />
            </TouchableOpacity>
            <ControlButton icon="arrow-right-bold" label={copy('games.rhythmRight')} onPress={() => setSafeDirection('right')} />
          </View>
          <View style={styles.dpadBottom}>
            <ControlButton icon="arrow-down-bold" label={copy('games.snakeDown')} onPress={() => setSafeDirection('down')} />
          </View>
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

function createObstacles(occupied: Point[], count: number): Point[] {
  const result: Point[] = [];
  while (result.length < count) {
    const point = {
      x: 1 + Math.floor(Math.random() * (BOARD_SIZE - 2)),
      y: 1 + Math.floor(Math.random() * (BOARD_SIZE - 2)),
    };
    if (![...occupied, ...result].some(item => samePoint(item, point))) {
      result.push(point);
    }
  }
  return result;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  missionRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm},
  lifePill: {flexDirection: 'row', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: 17, alignItems: 'center', backgroundColor: 'rgba(255,92,108,0.10)', borderWidth: 1, borderColor: 'rgba(255,92,108,0.24)'},
  notePill: {flexDirection: 'row', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: 17, alignItems: 'center', backgroundColor: 'rgba(255,213,74,0.10)', borderWidth: 1, borderColor: 'rgba(255,213,74,0.24)'},
  noteCount: {color: '#FFD54A', fontWeight: '900'},
  swipeHint: {marginLeft: 'auto', color: '#48E08A', fontSize: 10, fontWeight: '900', letterSpacing: 1.5},
  boardArea: {flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.sm},
  board: {alignSelf: 'center', padding: 6, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(72,224,138,0.48)', backgroundColor: '#0D1511', shadowColor: '#48E08A', shadowOpacity: 0.2, shadowRadius: 18, elevation: 8},
  row: {flexDirection: 'row'},
  cell: {width: 22, height: 22, margin: 0.5, borderRadius: 5, backgroundColor: '#111C16', borderWidth: 0.5, borderColor: '#1B2A21', alignItems: 'center', justifyContent: 'center'},
  snakeCell: {backgroundColor: '#26B96B', borderColor: '#67F0A4'},
  snakeHead: {backgroundColor: '#B8FF74', borderColor: '#E4FFC8'},
  snakeEye: {width: 5, height: 5, borderRadius: 3, backgroundColor: '#0B2B18'},
  foodCell: {backgroundColor: '#FFD54A', borderColor: '#FFF0A3', transform: [{scale: 0.86}]},
  goldenFoodCell: {backgroundColor: '#FF8A4C', borderColor: '#FFD4BA', shadowColor: '#FF8A4C', shadowOpacity: 0.8, shadowRadius: 5, elevation: 5},
  obstacleCell: {backgroundColor: '#33252B', borderColor: '#74505D', transform: [{scale: 0.82}]},
  obstacleCore: {width: 8, height: 8, borderRadius: 3, transform: [{rotate: '45deg'}], backgroundColor: '#B87A8E'},
  controls: {alignItems: 'center', justifyContent: 'center', gap: 4},
  dpadTop: {alignItems: 'center'},
  dpadMiddle: {flexDirection: 'row', alignItems: 'center', gap: 4},
  dpadBottom: {alignItems: 'center'},
  controlButton: {width: 52, height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17221B', borderWidth: 1, borderColor: 'rgba(72,224,138,0.28)'},
  pauseButton: {width: 52, height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26B96B', shadowColor: '#48E08A', shadowOpacity: 0.32, shadowRadius: 10, elevation: 6},
  helpText: {color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: SPACING.sm},
});

export default SnakeScreen;
