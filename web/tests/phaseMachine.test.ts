import { describe, it, expect, beforeEach } from 'vitest';
import { phaseStore, EXERCISE_DURATION } from '../src/game/phaseMachine';

function reset() {
  phaseStore.setState({ phase: 'Menu', round: 1, exerciseTimeLeft: EXERCISE_DURATION });
}

describe('phaseMachine', () => {
  beforeEach(reset);

  it('initial state is Menu with round 1 and full timer', () => {
    expect(phaseStore.getState().phase).toBe('Menu');
    expect(phaseStore.getState().round).toBe(1);
    expect(phaseStore.getState().exerciseTimeLeft).toBe(EXERCISE_DURATION);
  });

  it('Menu → Exercise via start()', () => {
    phaseStore.getState().start();
    expect(phaseStore.getState().phase).toBe('Exercise');
    expect(phaseStore.getState().exerciseTimeLeft).toBe(EXERCISE_DURATION);
  });

  it('start() is a no-op outside Menu', () => {
    phaseStore.getState().start(); // → Exercise
    phaseStore.getState().start(); // no-op
    expect(phaseStore.getState().phase).toBe('Exercise');
  });

  it('Exercise → Defense via startDefense()', () => {
    phaseStore.getState().start();
    phaseStore.getState().startDefense();
    expect(phaseStore.getState().phase).toBe('Defense');
  });

  it('Exercise → Defense via exerciseTimeout()', () => {
    phaseStore.getState().start();
    phaseStore.getState().exerciseTimeout();
    expect(phaseStore.getState().phase).toBe('Defense');
  });

  it('startDefense() is a no-op outside Exercise', () => {
    phaseStore.getState().startDefense();
    expect(phaseStore.getState().phase).toBe('Menu');
  });

  it('exerciseTimeout() is a no-op outside Exercise', () => {
    phaseStore.getState().exerciseTimeout();
    expect(phaseStore.getState().phase).toBe('Menu');
  });

  it('Defense → WaveClear via waveCleared() and increments round', () => {
    phaseStore.getState().start();
    phaseStore.getState().startDefense();
    phaseStore.getState().waveCleared();
    expect(phaseStore.getState().phase).toBe('WaveClear');
    expect(phaseStore.getState().round).toBe(2);
  });

  it('waveCleared() is a no-op outside Defense', () => {
    phaseStore.getState().waveCleared();
    expect(phaseStore.getState().phase).toBe('Menu');
    expect(phaseStore.getState().round).toBe(1);
  });

  it('Defense → GameOver via gameOver()', () => {
    phaseStore.getState().start();
    phaseStore.getState().startDefense();
    phaseStore.getState().gameOver();
    expect(phaseStore.getState().phase).toBe('GameOver');
  });

  it('gameOver() is a no-op outside Defense', () => {
    phaseStore.getState().gameOver();
    expect(phaseStore.getState().phase).toBe('Menu');
  });

  it('WaveClear → Exercise via nextRound() resets timer', () => {
    phaseStore.getState().start();
    phaseStore.getState().startDefense();
    phaseStore.getState().waveCleared();
    phaseStore.getState().nextRound();
    expect(phaseStore.getState().phase).toBe('Exercise');
    expect(phaseStore.getState().exerciseTimeLeft).toBe(EXERCISE_DURATION);
  });

  it('nextRound() is a no-op outside WaveClear', () => {
    phaseStore.getState().nextRound();
    expect(phaseStore.getState().phase).toBe('Menu');
  });

  it('full round trip Menu → Exercise → Defense → WaveClear → Exercise preserves round', () => {
    phaseStore.getState().start();
    phaseStore.getState().startDefense();
    phaseStore.getState().waveCleared();
    expect(phaseStore.getState().round).toBe(2);
    phaseStore.getState().nextRound();
    expect(phaseStore.getState().phase).toBe('Exercise');
    expect(phaseStore.getState().round).toBe(2);
  });

  it('setPhase() forces any phase without validation', () => {
    phaseStore.getState().setPhase('Defense');
    expect(phaseStore.getState().phase).toBe('Defense');
  });

  it('tickTimer() counts down in Exercise phase', () => {
    phaseStore.getState().start();
    phaseStore.getState().tickTimer(10);
    expect(phaseStore.getState().exerciseTimeLeft).toBeCloseTo(EXERCISE_DURATION - 10);
    expect(phaseStore.getState().phase).toBe('Exercise');
  });

  it('tickTimer() clamps to 0 and triggers exerciseTimeout', () => {
    phaseStore.getState().start();
    phaseStore.getState().tickTimer(EXERCISE_DURATION + 5);
    expect(phaseStore.getState().exerciseTimeLeft).toBe(0);
    expect(phaseStore.getState().phase).toBe('Defense');
  });

  it('tickTimer() is a no-op outside Exercise', () => {
    phaseStore.getState().tickTimer(10);
    expect(phaseStore.getState().phase).toBe('Menu');
    expect(phaseStore.getState().exerciseTimeLeft).toBe(EXERCISE_DURATION);
  });

  it('tickTimer() does not double-fire after timer reaches 0', () => {
    phaseStore.getState().start();
    phaseStore.getState().tickTimer(EXERCISE_DURATION + 1); // → Defense
    phaseStore.getState().tickTimer(1); // no-op: phase is now Defense
    expect(phaseStore.getState().phase).toBe('Defense');
  });
});
