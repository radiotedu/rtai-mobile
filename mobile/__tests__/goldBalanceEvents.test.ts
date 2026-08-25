import {describe, expect, it, jest} from '@jest/globals';

import {
  notifyGoldBalanceChanged,
  subscribeGoldBalanceChanges,
} from '../src/services/goldBalanceEvents';

describe('Gold balance events', () => {
  it('publishes only non-negative integer balances and supports unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeGoldBalanceChanges(listener);

    notifyGoldBalanceChanged(40);
    notifyGoldBalanceChanged(-1);
    notifyGoldBalanceChanged(1.5);
    unsubscribe();
    notifyGoldBalanceChanged(60);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(40);
  });
});
