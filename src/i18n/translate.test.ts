import { describe, it, expect } from 'vitest';
import { translate, type Dict } from './translate';

const dict: Dict = {
  app: { title: 'Geography Quiz' },
  greeting: 'Hello, {name}!',
  score: 'You scored {correct} of {total}',
};

describe('translate', () => {
  it('resolves a nested dot-separated key', () => {
    expect(translate(dict, 'app.title')).toBe('Geography Quiz');
  });

  it('interpolates named placeholders', () => {
    expect(translate(dict, 'greeting', { name: 'Sami' })).toBe('Hello, Sami!');
    expect(translate(dict, 'score', { correct: 7, total: 10 })).toBe('You scored 7 of 10');
  });

  it('leaves unknown placeholders intact', () => {
    expect(translate(dict, 'greeting', {})).toBe('Hello, {name}!');
  });

  it('returns the key itself when the path is missing', () => {
    expect(translate(dict, 'app.subtitle')).toBe('app.subtitle');
    expect(translate(dict, 'nope')).toBe('nope');
  });

  it('returns the key when the path resolves to an object, not a string', () => {
    expect(translate(dict, 'app')).toBe('app');
  });
});
