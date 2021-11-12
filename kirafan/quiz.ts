import { KirafanCard, kirafanTools, getKirafanCards } from './';
import {
  AteQuizProblem,
  typicalAteQuizHintTexts,
  typicalMessageTextsGenerator,
  AteQuiz,
} from '../atequiz';
import { SlackInterface } from '../lib/slack';
import sharp from 'sharp';
import axios from 'axios';
import { random, range, sample } from 'lodash';
import { ChatPostMessageArguments } from '@slack/web-api';
import cloudinary, { UploadApiResponse } from 'cloudinary';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { hiraganize } from 'japanese';

interface KirafanAteQuizProblem extends AteQuizProblem {
  correctAnswerCard: KirafanCard;
}

class KirafanAteQuiz extends AteQuiz {
  judge(answer: string): boolean {
    const normalize = (s: string) =>
      hiraganize(s.replace(/\P{Letter}/gu, '').toLowerCase());
    const normalizedAnswer = normalize(answer);
    return this.problem.correctAnswers.some(correctAnswer => {
      normalizedAnswer === normalize(correctAnswer);
    });
  }
}

type ImageFilter = (image: sharp.Sharp) => sharp.Sharp;

/**
 * Generate pictures for hints and store them in the local storage.
 * @param original filepath of the original image
 * @returns an array of string that contains filepaths of images
 */
const generateHintPictures = async (url: string) => {
  const originalSharp = sharp(
    await axios.get(url, { responseType: 'arraybuffer' }).then(res => res.data)
  );
  const { width, height } = await originalSharp.metadata();
  const filtersArray = [
    [
      (image: sharp.Sharp) => {
        const newHeight = Math.floor(width / 100);
        return image.clone().extract({
          left: 0,
          top: random(height - newHeight),
          width: width,
          height: newHeight,
        });
      },
    ],
    new Array<ImageFilter>(30).fill((image: sharp.Sharp) => {
      const newSize = 20;
      return image.clone().extract({
        left: random(width - newSize),
        top: random(height - newSize),
        width: newSize,
        height: newSize,
      });
    }),
    [
      (image: sharp.Sharp) => {
        const newSize = 200;
        return image
          .clone()
          .extract({
            left: random(width - newSize),
            top: random(height - newSize),
            width: newSize,
            height: newSize,
          })
          .blur();
      },
    ],
    [
      (image: sharp.Sharp) => {
        const newSize = 200;
        return image.clone().extract({
          left: random(width - newSize),
          top: random(height - newSize),
          width: newSize,
          height: newSize,
        });
      },
    ],
    [
      (image: sharp.Sharp) => {
        const newHeight = Math.floor(width / 2);
        return image.clone().extract({
          left: 0,
          top: random(height - newHeight),
          width,
          height: newHeight,
        });
      },
    ],
  ];

  const urlsArray = await Promise.all(
    filtersArray.map(
      async filters =>
        await Promise.all(
          filters.map(async filter => {
            const imageBuffer = await filter(originalSharp).toBuffer();
            return ((await new Promise((resolve, reject) =>
              cloudinary.v2.uploader
                .upload_stream(
                  { resource_type: 'image' },
                  (error, response) => {
                    if (error) {
                      reject(error);
                    } else {
                      resolve(response);
                    }
                  }
                )
                .end(imageBuffer)
            )) as UploadApiResponse).secure_url as string;
          })
        )
    )
  );

  console.log(urlsArray);

  return urlsArray;
};

const generateCorrectAnswers = (card: KirafanCard) => {
  return [card.fullname, ...card.fullname.split(/\s+/), card.nickname];
};

const generateProblem = async (
  card: KirafanCard
): Promise<KirafanAteQuizProblem> => {
  const channel = process.env.CHANNEL_SANDBOX;
  const hintImageUrls = await generateHintPictures(
    kirafanTools.getKirafanIllustUrl(card.cardId)
  );

  const problemMessage: ChatPostMessageArguments = {
    channel,
    text: 'このキャラクターは誰でしょう？',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: 'このキャラクターは誰でしょう？',
          emoji: true,
        },
      },
      {
        type: 'image',
        block_id: 'image',
        image_url: hintImageUrls[0][0],
        alt_text: 'このキャラクターは誰でしょう？',
      },
    ],
  };

  const hintMessages: ChatPostMessageArguments[] = typicalAteQuizHintTexts.map(
    (text, index) => ({
      channel,
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text,
            emoji: true,
          },
        },
        ...(index === 0
          ? range(3).map(i => ({
              type: 'context',
              elements: range(10).map(j => ({
                type: 'image',
                image_url: hintImageUrls[index + 1][i * 10 + j],
                alt_text: text,
              })),
            }))
          : [
              {
                type: 'image',
                block_id: 'image',
                image_url: hintImageUrls[index + 1][0],
                alt_text: text,
              },
            ]),
      ],
    })
  );

  const immediateMessage = {
    channel,
    text: typicalMessageTextsGenerator.immediate(),
  };

  const answerText = `＊${card.fullname}＊`;

  const solvedMessage = {
    channel,
    text: typicalMessageTextsGenerator.solved(answerText),
    reply_broadcast: true,
  };

  const unsolvedMessage = {
    channel,
    text: typicalMessageTextsGenerator.unsolved(answerText),
    reply_broadcast: true,
  };

  const answerMessage = {
    channel,
    text: card.fullname,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: card.fullname,
          emoji: true,
        },
      },
      {
        type: 'image',
        block_id: 'image',
        image_url: kirafanTools.getKirafanCardPictureUrl(card.cardId),
        alt_text: card.fullname,
      },
    ],
  };

  const correctAnswers = generateCorrectAnswers(card);

  const problem = {
    problemMessage,
    hintMessages,
    immediateMessage,
    solvedMessage,
    unsolvedMessage,
    answerMessage,
    correctAnswers,
    correctAnswerCard: JSON.parse(JSON.stringify(card)),
  } as KirafanAteQuizProblem;

  console.log(problem);

  return problem;
};

const postOption = {
  icon_emoji: ':claire_kirarafantasia:',
  username: 'クレア',
};

export default (slackClients: SlackInterface): void => {
  const { rtmClient: rtm } = slackClients;

  rtm.on('message', async message => {
    if (message.channel !== process.env.CHANNEL_SANDBOX) {
      return;
    }
    if (
      message.subtype === 'bot_message' ||
      message.subtype === 'slackbot_response'
    ) {
      return;
    }
    if (!message.text) {
      return;
    }

    // クイズ開始処理
    if (message.text.match(/^きらファン当てクイズ$/)) {
      const randomKirafanCard = sample(await getKirafanCards());
      const problem = await generateProblem(randomKirafanCard);
      const quiz = new KirafanAteQuiz(slackClients, problem, postOption);
      await quiz.start();
    }
  });
};
