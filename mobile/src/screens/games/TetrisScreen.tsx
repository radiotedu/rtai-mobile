import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, Vibration, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation, useRoute} from '@react-navigation/native';
import {COLORS, SPACING} from '../../theme/theme';
import {ArcadeGame} from '../../services/gamificationService';
import {createClientRoundId, prepareVerifiedGameRound, submitMobileGameScore} from './gameSession';
import {FeedbackToast, GameResultModal, GameShell} from './GameChrome';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../../i18n/appCopy';
import {isPracticeGame} from './gameRoutes';
import {logSafeError} from '../../utils/safeLog';

type Cell = {x: number; y: number};
type Piece = {shape: Cell[]; x: number; y: number; color: string};

const WIDTH = 8;
const HEIGHT = 14;
const SHAPES: Array<{shape: Cell[]; color: string}> = [
  {color: COLORS.primary, shape: [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}]},
  {color: '#FFB020', shape: [{x: 0, y: 0}, {x: 0, y: 1}, {x: 0, y: 2}, {x: 0, y: 3}]},
  {color: '#34C759', shape: [{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}, {x: 2, y: 1}]},
  {color: '#5AC8FA', shape: [{x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}, {x: 2, y: 1}]},
];

const TetrisScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const game = route.params?.game as ArcadeGame;
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const [occupied, setOccupied] = useState<Record<string, string>>({});
  const [piece, setPiece] = useState<Piece>(() => createPiece());
  const [nextPiece, setNextPiece] = useState<Piece>(() => createPiece());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [awardedXp, setAwardedXp] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const scoreRef = useRef(0);
  const submittedRef = useRef(false);
  const roundIdRef = useRef(createClientRoundId(game));
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    prepareVerifiedGameRound(game, roundIdRef.current);
  }, [game]);

  const activeCells = useMemo(() => getPieceCells(piece), [piece]);

  useEffect(() => {
    if (!running || gameOver) {
      return undefined;
    }

    const speed = Math.max(220, 560 - lines * 18);
    const timer = setInterval(moveDown, speed);
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
      logSafeError('games.tetris.submit', error);
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishGame = (finalScore = scoreRef.current) => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    setRunning(false);
    setGameOver(true);
    setFeedback(copy('games.tetrisFull'));
    submitFinalScore(finalScore);
  };

  const lockPiece = (currentPiece: Piece, currentOccupied: Record<string, string>) => {
    const nextOccupied = {...currentOccupied};
    getPieceCells(currentPiece).forEach((cell) => {
      nextOccupied[keyOf(cell)] = currentPiece.color;
    });

    const {grid, clearedRows} = clearRows(nextOccupied);
    const gained = 18 + clearedRows * clearedRows * 140;
    const nextScoreValue = scoreRef.current + gained;
    scoreRef.current = nextScoreValue;
    setScore(nextScoreValue);
    if (clearedRows > 0) {
      setLines((value) => value + clearedRows);
      setFeedback(`${clearedRows} ${copy('games.tetrisLines')} · +${gained}`);
      Vibration.vibrate(24);
    } else {
      setFeedback(`+${gained}`);
    }

    const spawn = {...nextPiece, x: 3, y: 0};
    const upcoming = createPiece();

    if (collides(spawn, grid)) {
      setOccupied(grid);
      finishGame(nextScoreValue);
      return;
    }

    setOccupied(grid);
    setPiece(spawn);
    setNextPiece(upcoming);
  };

  const moveDown = () => {
    const moved = {...piece, y: piece.y + 1};
    if (collides(moved, occupied)) {
      lockPiece(piece, occupied);
      return;
    }

    setPiece(moved);
  };

  const moveHorizontal = (delta: number) => {
    setPiece((current) => {
      const moved = {...current, x: current.x + delta};
      return collides(moved, occupied) ? current : moved;
    });
  };

  const rotate = () => {
    setPiece((current) => {
      const rotated = {
        ...current,
        shape: current.shape.map((cell) => ({x: -cell.y + 1, y: cell.x})),
      };
      return collides(rotated, occupied) ? current : rotated;
    });
  };

  const drop = () => {
    let dropped = piece;
    while (!collides({...dropped, y: dropped.y + 1}, occupied)) {
      dropped = {...dropped, y: dropped.y + 1};
    }
    lockPiece(dropped, occupied);
  };

  const resetGame = () => {
    roundIdRef.current = createClientRoundId(game);
    prepareVerifiedGameRound(game, roundIdRef.current);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    scoreRef.current = 0;
    setOccupied({});
    setPiece(createPiece());
    setNextPiece(createPiece());
    setScore(0);
    setLines(0);
    setGameOver(false);
    setRunning(true);
    setAwardedXp(0);
    setSubmitFailed(false);
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameShell
        title={copy('games.tetris')}
        subtitle={copy('games.tetrisSubtitle')}
        icon="view-grid-plus-outline"
        accentColor="#46C8FF"
        score={score}
        progressLabel={`${lines} ${copy('games.tetrisLines')}`}
        rightLabel={`${copy('games.speed')} ${Math.min(9, Math.floor(lines / 2) + 1)}`}
        onBack={() => navigation.goBack()}>
        <FeedbackToast text={feedback} />
        <View style={styles.gameRow}>
          <View style={styles.board}>
            {Array.from({length: HEIGHT}).map((_, y) => (
              <View key={y} style={styles.row}>
                {Array.from({length: WIDTH}).map((__, x) => {
                  const key = keyOf({x, y});
                  const active = activeCells.some((cell) => cell.x === x && cell.y === y);
                  return (
                    <View
                      key={key}
                      style={[
                        styles.cell,
                        occupied[key] ? {backgroundColor: occupied[key]} : null,
                        active ? {backgroundColor: piece.color} : null,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.sidePanel}>
            <Text style={styles.nextTitle}>{copy('games.next')}</Text>
            <MiniPiece piece={nextPiece} />
            <TouchableOpacity style={styles.pauseButton} onPress={() => setRunning((value) => !value)} disabled={gameOver}>
              <Icon name={running ? 'pause' : 'play'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.dpadTop}>
            <ControlButton icon="rotate-right" onPress={rotate} disabled={gameOver} />
          </View>
          <View style={styles.dpadMiddle}>
            <ControlButton icon="arrow-left-bold" onPress={() => moveHorizontal(-1)} disabled={gameOver} />
            <View style={styles.dpadCenter} />
            <ControlButton icon="arrow-right-bold" onPress={() => moveHorizontal(1)} disabled={gameOver} />
          </View>
          <View style={styles.dpadBottom}>
            <ControlButton icon="arrow-down-bold" onPress={drop} disabled={gameOver} />
          </View>
        </View>
      </GameShell>

      <GameResultModal
        visible={gameOver}
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

function MiniPiece({piece}: {piece: Piece}) {
  return (
    <View style={styles.miniBoard}>
      {Array.from({length: 4}).map((_, y) => (
        <View key={y} style={styles.miniRow}>
          {Array.from({length: 4}).map((__, x) => {
            const active = piece.shape.some((cell) => cell.x === x || (cell.x + 1 === x && piece.shape.length === 4))
              && piece.shape.some((cell) => cell.y === y || cell.y + 1 === y);
            const exact = piece.shape.some((cell) => cell.x === x && cell.y === y);
            return <View key={`${x}-${y}`} style={[styles.miniCell, (exact || active) && {backgroundColor: piece.color}]} />;
          })}
        </View>
      ))}
    </View>
  );
}

function ControlButton({icon, onPress, disabled}: {icon: string; onPress: () => void; disabled?: boolean}) {
  return (
    <TouchableOpacity style={[styles.controlButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Icon name={icon} size={26} color={COLORS.text} />
    </TouchableOpacity>
  );
}

function createPiece(): Piece {
  const item = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {shape: item.shape, color: item.color, x: 3, y: 0};
}

function getPieceCells(piece: Piece): Cell[] {
  return piece.shape.map((cell) => ({x: cell.x + piece.x, y: cell.y + piece.y}));
}

function collides(piece: Piece, occupied: Record<string, string>) {
  return getPieceCells(piece).some((cell) => (
    cell.x < 0 ||
    cell.x >= WIDTH ||
    cell.y < 0 ||
    cell.y >= HEIGHT ||
    Boolean(occupied[keyOf(cell)])
  ));
}

function clearRows(occupied: Record<string, string>) {
  const fullRows = Array.from({length: HEIGHT})
    .map((_, y) => y)
    .filter((y) => Array.from({length: WIDTH}).every((__, x) => occupied[keyOf({x, y})]));

  if (fullRows.length === 0) {
    return {grid: occupied, clearedRows: 0};
  }

  const grid: Record<string, string> = {};
  Object.entries(occupied).forEach(([key, color]) => {
    const [x, y] = key.split(':').map(Number);
    if (fullRows.includes(y)) {
      return;
    }
    const rowsBelow = fullRows.filter((row) => row > y).length;
    grid[keyOf({x, y: y + rowsBelow})] = color;
  });

  return {grid, clearedRows: fullRows.length};
}

function keyOf(cell: Cell) {
  return `${cell.x}:${cell.y}`;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  gameRow: {flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.lg},
  board: {padding: 6, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(70,200,255,0.48)', backgroundColor: '#0C151B', shadowColor: '#46C8FF', shadowOpacity: 0.18, shadowRadius: 16, elevation: 7},
  row: {flexDirection: 'row'},
  cell: {width: 23, height: 23, margin: 1, borderRadius: 5, backgroundColor: '#111E26', borderWidth: 1, borderColor: '#1B303D'},
  sidePanel: {width: 86, alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderRadius: 22, backgroundColor: 'rgba(70,200,255,0.07)', borderWidth: 1, borderColor: 'rgba(70,200,255,0.22)'},
  nextTitle: {color: COLORS.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase'},
  miniBoard: {padding: SPACING.xs, borderRadius: 14, backgroundColor: '#0E1B22', borderWidth: 1, borderColor: 'rgba(70,200,255,0.34)'},
  miniRow: {flexDirection: 'row'},
  miniCell: {width: 14, height: 14, margin: 1, borderRadius: 4, backgroundColor: '#1B303D'},
  pauseButton: {width: 54, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1479A3'},
  controls: {alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: SPACING.xs},
  dpadTop: {alignItems: 'center'},
  dpadMiddle: {flexDirection: 'row', alignItems: 'center', gap: 4},
  dpadBottom: {alignItems: 'center'},
  dpadCenter: {width: 52, height: 52},
  controlButton: {width: 52, height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#13232C', borderWidth: 1, borderColor: 'rgba(70,200,255,0.28)'},
  disabled: {opacity: 0.5},
});

export default TetrisScreen;
