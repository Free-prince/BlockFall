import type { PostHog } from 'posthog-react-native';

export function createGameLogger(posthog?: PostHog) {
  return {
    gameStarted: () => posthog?.logger.info('game started'),
    scoreSubmitted: (score: number, lines: number, level: number, hasRank: boolean) =>
      posthog?.logger.info('score submitted', { score, lines, level, has_rank: hasRank }),
    scoreSubmissionFailed: () => posthog?.logger.warn('score submission failed'),
    gameQuit: (score: number, lines: number, level: number) =>
      posthog?.logger.info('game quit', { score, lines, level }),
  };
}
