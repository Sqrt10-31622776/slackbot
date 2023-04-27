import {Mutex} from 'async-mutex';
import {v2 as cloudinary} from 'cloudinary';
import {random, sample} from 'lodash';
import QRCode, {QRCodeSegmentMode} from 'qrcode';
import toSJIS from 'qrcode/helper/to-sjis';
import sharp from 'sharp';
import {increment} from '../achievements';
import {AteQuiz, typicalMessageTextsGenerator} from '../atequiz';
// @ts-expect-error: untyped
import {getDictionary} from '../hangman';
import {SlackInterface} from '../lib/slack';
import {Loader} from '../lib/utils';
// @ts-expect-error: untyped
import {getCandidateWords} from '../tahoiya/lib';

const mutex = new Mutex();

const uploadImage = async (image: Buffer): Promise<string> => {
	const response = await new Promise((resolve, reject) => {
		cloudinary.uploader.upload_stream((error: any, data: any) => {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		}).end(image);
	});
	// @ts-expect-error: Untyped
	return response.secure_url;
};

const SIZE = 20;

const generateQuizQrcode = async ({data, mode, isUnmasked}: { data: string, mode: QRCodeSegmentMode, isUnmasked: boolean}) => {
	const qrcode = QRCode.create([{data, mode}], {
		toSJISFunc: toSJIS,
		version: 1,
		errorCorrectionLevel: 'L',
		...(isUnmasked ? {maskPattern: 0} : {}),
	});

	const modules = qrcode.modules.data;

	const image = await sharp(Buffer.from(Array.from(
		{length: modules.length * SIZE * SIZE},
		(_d, i) => {
			const x = Math.floor((i % (qrcode.modules.size * SIZE)) / SIZE);
			const y = Math.floor(i / (qrcode.modules.size * SIZE * SIZE));

			if (
				(x < 7 && y < 7) ||
				(x >= qrcode.modules.size - 7 && y < 7) ||
				(x < 7 && y >= qrcode.modules.size - 7)
			) {
				return 200;
			}

			const bit = modules[y * qrcode.modules.size + x];
			const isReserved = qrcode.modules.reservedBit[y * qrcode.modules.size + x];

			if (!isUnmasked || isReserved === 1) {
				return bit === 0 ? 255 : 0;
			}

			return (bit ^ (x % 2) ^ (y % 2) ^ 1) === 0 ? 255 : 0;
		},
	)), {
		raw: {
			width: qrcode.modules.size * SIZE,
			height: qrcode.modules.size * SIZE,
			channels: 1,
		},
	}).png().toBuffer();

	return image;
};

const generateOriginalQrcode = async ({data, mode, isUnmasked}: { data: string, mode: QRCodeSegmentMode, isUnmasked: boolean}) => {
	const qrcode = QRCode.create([{data, mode}], {
		toSJISFunc: toSJIS,
		version: 1,
		errorCorrectionLevel: 'L',
		...(isUnmasked ? {maskPattern: 0} : {}),
	});

	const modules = qrcode.modules.data;

	const image = await sharp(Buffer.from(Array.from(
		{length: modules.length * SIZE * SIZE},
		(_d, i) => {
			const x = Math.floor((i % (qrcode.modules.size * SIZE)) / SIZE);
			const y = Math.floor(i / (qrcode.modules.size * SIZE * SIZE));
			return modules[y * qrcode.modules.size + x] === 0 ? 255 : 0;
		},
	)), {
		raw: {
			width: qrcode.modules.size * SIZE,
			height: qrcode.modules.size * SIZE,
			channels: 1,
		},
	}).png().toBuffer();

	return image;
};

const generateQrcode = async ({data, mode, isUnmasked}: {data: string, mode: QRCodeSegmentMode, isUnmasked: boolean}) => {
	const quizQrcode = await generateQuizQrcode({data, mode, isUnmasked});
	const originalQrcode = await generateOriginalQrcode({data, mode, isUnmasked});

	return {
		quiz: await uploadImage(quizQrcode),
		original: await uploadImage(originalQrcode),
	};
};

type Difficulty = 'easy' | 'normal' | 'hard';
type Mode = 'alphabet' | 'hiragana' | 'numeric' | 'kanji' | 'random';

const parseQuizOptions = (text: string) => {
	const tokens = text.split(/\s+/);

	let isUnmasked = false;
	let difficulty: Difficulty = 'easy';
	let mode: Mode = 'random';
	for (const token of tokens) {
		if (token.toLowerCase() === 'unmasked') {
			isUnmasked = true;
		}
		if (token.toLowerCase() === 'easy') {
			difficulty = 'easy';
		}
		if (token.toLowerCase() === 'normal') {
			difficulty = 'normal';
		}
		if (token.toLowerCase() === 'hard') {
			difficulty = 'hard';
		}
		if (token.toLowerCase() === 'numeric') {
			mode = 'numeric';
		}
		if (token.toLowerCase() === 'alphabet') {
			mode = 'alphabet';
		}
		if (token.toLowerCase() === 'hiragana') {
			mode = 'hiragana';
		}
		if (token.toLowerCase() === 'kanji') {
			mode = 'kanji';
		}
		if (token.toLowerCase() === 'random') {
			mode = 'random';
		}
	}

	return {
		isUnmasked,
		difficulty,
		mode,
	};
};

type TahoiyaWord = [word: string, ruby: string, source: string, meaning: string, id: string];

const hangmanDictionaryLoader = new Loader<string[]>(getDictionary);
const hiraganaDictionaryLoader = new Loader<string[]>(async () => (
	(await getCandidateWords({min: 0, max: Infinity}) as TahoiyaWord[])
		.map(([, ruby]) => ruby)
));
const kanjiDictionaryLoader = new Loader<string[]>(async () => (
	(await getCandidateWords({min: 0, max: Infinity}) as TahoiyaWord[])
		.map(([word]) => word)
));

const getAlphabetText = async (difficulty: Difficulty) => {
	const hangmanDictionary = await hangmanDictionaryLoader.load();

	if (difficulty === 'easy') {
		const candidateWords = hangmanDictionary
			.slice(0, 1000)
			.filter((word) => word.length === 3 || word.length === 4);
		return sample(candidateWords).toUpperCase();
	}

	if (difficulty === 'normal') {
		const candidateWords = hangmanDictionary
			.slice(0, 2000)
			.filter((word) => word.length >= 5 && word.length <= 8);
		return sample(candidateWords).toUpperCase();
	}

	const candidateWords = hangmanDictionary
		.slice(0, 8000)
		.filter((word) => word.length >= 9 || word.length <= 25);
	return sample(candidateWords).toUpperCase();
};

const getHiraganaText = async (difficulty: Difficulty) => {
	const tahoiyaDictionary = await hiraganaDictionaryLoader.load();

	if (difficulty === 'easy') {
		const candidateWords = tahoiyaDictionary
			.filter((word) => word.length === 2);
		return sample(candidateWords);
	}

	if (difficulty === 'normal') {
		const candidateWords = tahoiyaDictionary
			.filter((word) => word.length === 3 || word.length === 4);
		return sample(candidateWords);
	}

	const candidateWords = tahoiyaDictionary
		.filter((word) => word.length >= 5 || word.length <= 10);
	return sample(candidateWords);
};

const getNumericText = (difficulty: Difficulty) => {
	if (difficulty === 'easy') {
		return random(999).toString();
	}

	if (difficulty === 'normal') {
		return random(1_000_000, 999_999_999).toString();
	}

	return Array(40).fill('').map(() => random(9).toString()).join('');
};

const getKanjiText = async (difficulty: Difficulty) => {
	const tahoiyaDictionary = await kanjiDictionaryLoader.load();

	if (difficulty === 'easy') {
		const candidateWords = tahoiyaDictionary
			.filter((word) => word.length === 1);
		return sample(candidateWords);
	}

	if (difficulty === 'normal') {
		const candidateWords = tahoiyaDictionary
			.filter((word) => word.length === 2);
		return sample(candidateWords);
	}

	const candidateWords = tahoiyaDictionary
		.filter((word) => word.length >= 3 || word.length <= 10);
	return sample(candidateWords);
};

const generateQuiz = async (difficulty: Difficulty, modeOption: Mode): Promise<{
	gameMode: Mode,
	mode: QRCodeSegmentMode,
	data: string,
}> => {
	let mode = modeOption;
	if (mode === 'random') {
		if (difficulty === 'easy') {
			mode = sample(['alphabet', 'hiragana']);
		}
		if (difficulty === 'normal') {
			mode = sample(['alphabet', 'hiragana', 'numeric']);
		}
		if (difficulty === 'hard') {
			mode = sample(['alphabet', 'hiragana', 'numeric', 'kanji']);
		}
	}

	if (mode === 'alphabet') {
		return {
			gameMode: mode,
			mode: 'alphanumeric',
			data: await getAlphabetText(difficulty),
		};
	}

	if (mode === 'hiragana') {
		return {
			gameMode: mode,
			mode: 'kanji',
			data: await getHiraganaText(difficulty),
		};
	}

	if (mode === 'numeric') {
		return {
			gameMode: mode,
			mode: 'numeric',
			data: getNumericText(difficulty),
		};
	}

	return {
		gameMode: mode,
		mode: 'kanji',
		data: await getKanjiText(difficulty),
	};
};

class QrAteQuiz extends AteQuiz {
	waitSecGen() {
		return 300;
	}
}

export default (slackClients: SlackInterface) => {
	const {eventClient} = slackClients;

	eventClient.on('message', (message) => {
		if (message.channel !== process.env.CHANNEL_SANDBOX) {
			return;
		}

		const {text, channel} = message;

		mutex.runExclusive(async () => {
			if (
				text &&
				text.startsWith('QR当てクイズ')
			) {
				const quizOptions = parseQuizOptions(text.slice('QR当てクイズ'.length));
				const quiz = await generateQuiz(quizOptions.difficulty, quizOptions.mode);
				const imageUrl = await generateQrcode({
					data: quiz.data,
					mode: quiz.mode,
					isUnmasked: quizOptions.isUnmasked,
				});

				const quizText = `このQRコード、なんと書いてあるでしょう? (difficulty = ${quizOptions.difficulty}, mode = ${quizOptions.mode}, isUnmasked = ${quizOptions.isUnmasked})`;

				const ateQuiz = new QrAteQuiz(slackClients, {
					problemMessage: {
						channel,
						text: quizText,
						blocks: [
							{
								type: 'section',
								text: {
									type: 'plain_text',
									text: quizText,
								},
							},
							{
								type: 'image',
								image_url: imageUrl.quiz,
								alt_text: 'QRコード',
							},
						],
					},
					hintMessages: [],
					immediateMessage: {channel, text: '300秒以内に回答してね！'},
					solvedMessage: {
						channel,
						text: typicalMessageTextsGenerator.solved(`＊${quiz.data}＊`),
						reply_broadcast: true,
					},
					unsolvedMessage: {
						channel,
						text: typicalMessageTextsGenerator.unsolved(`＊${quiz.data}＊`),
						reply_broadcast: true,
					},
					answerMessage: {
						channel,
						text: 'QRコード',
						blocks: [
							{
								type: 'image',
								image_url: imageUrl.original,
								alt_text: quiz.data,
							},
						],
					},
					correctAnswers: [quiz.data, quiz.data.toLowerCase()],
				}, {});

				const startTime = Date.now();
				const result = await ateQuiz.start();
				const endTime = Date.now();
				const duration = endTime - startTime;

				if (result.state === 'solved') {
					await increment(message.user, 'qrcode-quiz-answer');
					if (quiz.gameMode === 'alphabet') {
						await increment(message.user, 'qrcode-quiz-answer-alphabet');
					}
					if (quiz.gameMode === 'hiragana') {
						await increment(message.user, 'qrcode-quiz-answer-hiragana');
					}
					if (quiz.gameMode === 'kanji') {
						await increment(message.user, 'qrcode-quiz-answer-kanji');
					}
					if (quiz.gameMode === 'numeric') {
						await increment(message.user, 'qrcode-quiz-answer-numeric');
					}
					if (quizOptions.difficulty === 'easy') {
						await increment(message.user, 'qrcode-quiz-answer-easy-or-above');
					}
					if (quizOptions.difficulty === 'normal') {
						await increment(message.user, 'qrcode-quiz-answer-easy-or-above');
						await increment(message.user, 'qrcode-quiz-answer-normal-or-above');
					}
					if (quizOptions.difficulty === 'hard') {
						await increment(message.user, 'qrcode-quiz-answer-easy-or-above');
						await increment(message.user, 'qrcode-quiz-answer-normal-or-above');
						await increment(message.user, 'qrcode-quiz-answer-hard-or-above');
					}
					if (duration < 10000) {
						await increment(message.user, 'qrcode-quiz-answer-less-than-10s');
					}
					if (duration < 30000) {
						await increment(message.user, 'qrcode-quiz-answer-less-than-30s');
					}
					if (duration < 150000) {
						await increment(message.user, 'qrcode-quiz-answer-less-than-150s');
					}
				}
			}
		});
	});
};
