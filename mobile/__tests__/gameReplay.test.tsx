import React from 'react';
import renderer, {act, ReactTestRenderer} from 'react-test-renderer';
import {Modal, TouchableOpacity} from 'react-native';
import {GameResultModal, GameShell} from '../src/screens/games/GameChrome';
import {getLocalBest, recordLocalBest} from '../src/services/localGameBests';

jest.setTimeout(30000);
jest.mock('@react-navigation/native', () => ({useRoute: () => ({name: 'replay-test'})}));
jest.mock('react-i18next', () => ({useTranslation: () => ({i18n: {language: 'en'}})}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/screens/games/gameSession', () => ({getGameResultMessage: () => 'Score'}));

it('records completed rounds, supports explicit replay and Android back, and keeps Gold submission separate', async () => {
  const onRestart = jest.fn();
  const onExit = jest.fn();
  const onRetrySubmit = jest.fn();
  let tree: ReactTestRenderer;
  const render = (visible: boolean) => <GameResultModal visible={visible} score={420} awardedXp={0} practice onRestart={onRestart} onExit={onExit} onRetrySubmit={onRetrySubmit} />;
  await act(async () => { tree = renderer.create(render(false)); });
  expect(getLocalBest('replay-test')).toBe(0);
  await act(async () => { tree!.update(render(true)); });
  expect(getLocalBest('replay-test')).toBe(420);
  expect(JSON.stringify(tree!.toJSON())).toContain('New personal best');
  expect(onRestart).not.toHaveBeenCalled();
  expect(onRetrySubmit).not.toHaveBeenCalled();
  act(() => tree!.root.findByType(Modal).props.onRequestClose());
  expect(onExit).toHaveBeenCalledTimes(1);
  const buttons = tree!.root.findAllByType(TouchableOpacity);
  act(() => buttons[buttons.length - 1].props.onPress());
  expect(onRestart).toHaveBeenCalledTimes(1);
  act(() => tree!.unmount());
});

it('shows progress towards the stored best without awarding anything during a round', async () => {
  await recordLocalBest('replay-test', 420);
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<GameShell title="Game" score={210} onBack={() => {}}>{null}</GameShell>);
  });
  const progress = tree!.root.findAll(node => node.props.accessibilityRole === 'progressbar')[0];
  expect(progress.props.accessibilityValue).toEqual({min: 0, max: 420, now: 210});
  expect(getLocalBest('replay-test')).toBe(420);
  act(() => tree!.unmount());
});
