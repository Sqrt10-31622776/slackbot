import { KirafanCard, kirafanTools, getKirafanCards } from './';
import { AteQuizProblem, AteQuiz } from '../atequiz';
import { SlackInterface } from '../lib/slack';
import sharp from 'sharp';
import axios from 'axios';
import { random, range, sample } from 'lodash';
import { ChatPostMessageArguments } from '@slack/web-api';
import cloudinary, { UploadApiResponse } from 'cloudinary';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { hiraganize } from 'japanese';
import { increment } from '../achievements';

interface KirafanAteQuizProblem extends AteQuizProblem {
  correctAnswerCard: KirafanCard;
}

class KirafanAteQuiz extends AteQuiz {
  judge(answer: string): boolean {
    const normalize = (s: string) =>
      hiraganize(s.replace(/\P{Letter}/gu, '').toLowerCase());
    const normalizedAnswer = normalize(answer);
    return this.problem.correctAnswers.some(
      correctAnswer => normalizedAnswer === normalize(correctAnswer)
    );
  }
}

type ImageFilter = (image: sharp.Sharp) => Promise<Buffer>;

/**
 * Generate pictures for hints and store them in the local storage.
 * @param url url of the original image
 * @returns an array of string that contains filepaths of images
 */
const generateHintPictures = async (url: string) => {
  const originalSharp = sharp(
    await axios.get(url, { responseType: 'arraybuffer' }).then(res => res.data)
  );
  const trimmedSharp = sharp(await originalSharp.trim().toBuffer());
  const biasedRandom = (max: number) => {
    const r = Math.random() * 2 - 1;
    return Math.max(
      0,
      Math.min(max - 1, Math.floor(((r * r * r + r + 2) / 4) * max))
    );
  };
  const filtersArray = [
    [
      async (image: sharp.Sharp) => {
        const { width, height } = await image.metadata();
        const newHeight = Math.floor(width / 100);
        return image
          .clone()
          .extract({
            left: 0,
            top: random(height - newHeight),
            width: width,
            height: newHeight,
          })
          .toBuffer();
      },
    ],
    new Array<ImageFilter>(30).fill(async (image: sharp.Sharp) => {
      const { width, height } = await image.metadata();
      const newSize = 20;
      return image
        .clone()
        .extract({
          left: biasedRandom(width - newSize),
          top: random(height - newSize),
          width: newSize,
          height: newSize,
        })
        .toBuffer();
    }),
    [
      async (image: sharp.Sharp) => {
        const { width, height } = await image.metadata();
        const newSize = 150;
        const pixelSize = newSize / 10;
        return sharp(
          await image
            .clone()
            .extract({
              left: biasedRandom(width - newSize),
              top: random(height - newSize),
              width: newSize,
              height: newSize,
            })
            .resize(pixelSize, pixelSize)
            .toBuffer()
        )
          .resize(newSize, newSize, { kernel: sharp.kernel.nearest })
          .toBuffer();
      },
    ],
    [
      async (image: sharp.Sharp) => {
        const { width, height } = await image.metadata();
        const newSize = 150;
        return image
          .clone()
          .extract({
            left: biasedRandom(width - newSize),
            top: random(height - newSize),
            width: newSize,
            height: newSize,
          })
          .toBuffer();
      },
    ],
    [
      async (image: sharp.Sharp) => {
        const { width, height } = await image.metadata();
        const newHeight = Math.floor(width / 2);
        return image
          .clone()
          .extract({
            left: 0,
            top: random(height - newHeight),
            width,
            height: newHeight,
          })
          .toBuffer();
      },
    ],
  ];

  const urlsArray = await Promise.all(
    filtersArray.map(
      async filters =>
        await Promise.all(
          filters.map(async filter => {
            const imageBuffer = await filter(trimmedSharp);
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
    kirafanTools.getKirafanCardBustIllustUrl(card.cardId)
  );

  const problemMessage: ChatPostMessageArguments = {
    channel,
    text: 'こちらの方、どなたでしょう？',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: 'こちらの方、どなたでしょう？',
          emoji: true,
        },
      },
      {
        type: 'image',
        block_id: 'image',
        image_url: hintImageUrls[0][0],
        alt_text: 'こちらの方、どなたでしょう？',
      },
    ],
  };

  const hintTexts = [
    'ヒント、開きますよーっ！',
    '次のヒントです！この方は…',
    'まだまだいきますよー！',
    '最後のヒントです！わかりましたか？',
  ];
  const hintMessages: ChatPostMessageArguments[] = hintTexts.map(
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
    text: '15秒でヒントです！',
  };

  const solvedMessage = {
    channel,
    text: `<@[[!user]]>さん、正解です！:tada:\nこの方は『${card.title}』の＊${card.fullname}＊さんです！す、す、すごかったです！:cherry_blossom:`,
    reply_broadcast: true,
  };

  const unsolvedMessage = {
    channel,
    text: `正解は『${card.title}』の＊${card.fullname}＊さんでした！またいつでも来てくださいね！:key:`,
    reply_broadcast: true,
  };

  const answerMessage = {
    channel,
    text: card.fullname,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `＊${card.fullname}＊ (${card.title})\n` +
            '★'.repeat(card.rare + 1) +
            ` ${kirafanTools.kirafanElementNames[card.element]} ${
              kirafanTools.kirafanClassNames[card.class]
            }`,
        },
      },
      {
        type: 'image',
        block_id: 'image',
        image_url: kirafanTools.getKirafanCardPictureUrl(card.cardId),
        alt_text:
          `＊${card.fullname}＊ (${card.title})\n` +
          '★'.repeat(card.rare + 1) +
          ` ${kirafanTools.kirafanElementNames[card.element]} ${
            kirafanTools.kirafanClassNames[card.class]
          }`,
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
      const result = await quiz.start();
      if (result.state === 'solved') {
        await increment(result.correctAnswerer, 'kirafan-answer');
        if (result.hintIndex === 1) {
          await increment(result.correctAnswerer, 'kirafan-answer-first-hint');
        }
        if (result.hintIndex <= 2) {
          await increment(result.correctAnswerer, 'kirafan-answer-second-hint');
        }
        if (result.hintIndex <= 3) {
          await increment(result.correctAnswerer, 'kirafan-answer-third-hint');
        }
      }
    }
  });
};
