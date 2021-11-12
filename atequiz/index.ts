import { WebAPICallOptions, WebClient } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import { SlackInterface } from '../lib/slack';
import { ChatPostMessageArguments } from '@slack/web-api/dist/methods';
import assert from 'assert';
import { Mutex } from 'async-mutex';
import { Deferred } from '../lib/utils';

export interface AteQuizProblem {
  problemMessage: ChatPostMessageArguments;
  hintMessages: ChatPostMessageArguments[];
  immediateMessage: ChatPostMessageArguments;
  solvedMessage: ChatPostMessageArguments;
  unsolvedMessage: ChatPostMessageArguments;
  answerMessage: ChatPostMessageArguments;
  correctAnswers: string[];
}

type AteQuizState = 'waiting' | 'solving' | 'solved' | 'unsolved';

export interface AteQuizResult {
  quiz: AteQuizProblem;
  state: 'solved' | 'unsolved';
  correctAnswerer: string | null;
  hintIndex: number | null;
}

export const typicalAteQuizHintTexts = [
  'しょうがないにゃあ、ヒントだよ',
  'もう一つヒントだよ、早く答えてね',
  'まだわからないの？ヒント追加するからね',
  '最後のヒントだよ！もうわかるよね？',
];

export const typicalMessageTextsGenerator = {
  problem: (genre: string): string => `この${genre}なーんだ`,
  immediate: (): string => '15秒経過でヒントを出すよ♫',
  solved: (answer: string, user: string): string =>
    `<@${user}> 正解:tada:\n答えは＊${answer}) だよ:muscle:`,
  unsolved: (answer: string): string =>
    `もう、しっかりして！\n答えは＊${answer}) だよ:anger:`,
};

/**
 * A Class for XX当てクイズ for #sandbox.
 * Channels of hints must be same as problem channel. thread_ts will be ignored.
 * To use other judge/watSecGen/ngReaction, please extend this class.
 */
export class AteQuiz {
  rtm: RTMClient;
  slack: WebClient;
  problem: AteQuizProblem;
  ngReaction = 'no_good';
  state: AteQuizState = 'waiting';
  mutex: Mutex;
  postOption: WebAPICallOptions;
  judge(answer: string): boolean {
    return this.problem.correctAnswers.some(correctAnswer => {
      answer === correctAnswer;
    });
  }
  waitSecGen(hintIndex: number): number {
    return hintIndex === this.problem.hintMessages.length ? 30 : 15;
  }

  constructor(
    { rtmClient: rtm, webClient: slack }: SlackInterface,
    problem: AteQuizProblem,
    option?: WebAPICallOptions
  ) {
    this.rtm = rtm;
    this.slack = slack;
    this.problem = JSON.parse(JSON.stringify(problem));
    this.postOption = JSON.parse(JSON.stringify(option));

    assert(
      this.problem.hintMessages.every(
        hint => hint.channel === this.problem.problemMessage.channel
      )
    );

    this.mutex = new Mutex();
  }

  /**
   * Start AteQuiz.
   * @returns A promise of AteQuizResult that becomes resolved when the quiz ends.
   */
  async start(): Promise<AteQuizResult> {
    this.state = 'solving';

    const postMessage = (message: ChatPostMessageArguments) => {
      return this.slack.chat.postMessage(
        Object.assign({}, message, this.postOption)
      );
    };

    const { ts: thread_ts } = await postMessage(this.problem.problemMessage);
    assert(typeof thread_ts === 'string');
    await postMessage(
      Object.assign({}, this.problem.immediateMessage, { thread_ts })
    );

    const result: AteQuizResult = {
      quiz: this.problem,
      state: 'unsolved',
      correctAnswerer: null,
      hintIndex: null,
    };

    let previousHintTime = Date.now();
    let hintIndex = 0;

    const deferred = new Deferred<AteQuizResult>();

    const onTick = () => {
      this.mutex.runExclusive(async () => {
        const now = Date.now();
        const nextHintTime =
          previousHintTime + 1000 * this.waitSecGen(hintIndex);

        if (this.state === 'solving' && nextHintTime <= now) {
          previousHintTime = now;
          if (hintIndex < this.problem.hintMessages.length) {
            const hint = this.problem.hintMessages[hintIndex];
            await postMessage(Object.assign({}, hint, { thread_ts }));
            hintIndex++;
          } else {
            this.state = 'unsolved';
            await postMessage(
              Object.assign({}, this.problem.unsolvedMessage, { thread_ts })
            );
            await postMessage(
              Object.assign({}, this.problem.answerMessage, { thread_ts })
            );
            clearInterval(tickTimer);
            deferred.resolve(result);
          }
        }
      });
    };

    const tickTimer = setInterval(onTick, 1000);

    this.rtm.on('message', async message => {
      if (message.thread_ts === thread_ts) {
        if (this.state === 'solving') {
          const answer = message.text as string;
          const isCorrect = this.judge(answer);
          if (isCorrect) {
            this.state = 'solved';
            clearInterval(tickTimer);

            await postMessage(
              Object.assign({}, this.problem.solvedMessage, { thread_ts })
            );
            await postMessage(
              Object.assign({}, this.problem.answerMessage, { thread_ts })
            );

            result.correctAnswerer = message.user;
            result.hintIndex = hintIndex;
            result.state = 'solved';
            deferred.resolve(result);
          } else {
            this.slack.reactions.add({
              name: this.ngReaction,
              channel: message.channel,
              timestamp: message.ts,
            });
          }
        }
      }
    });

    return deferred.promise;
  }
}
