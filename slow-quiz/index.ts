import type {ChatPostMessageArguments, ImageElement, KnownBlock, WebClient} from '@slack/web-api';
import {Mutex} from 'async-mutex';
import {stripIndent} from 'common-tags';
// @ts-ignore
import {hiraganize} from 'japanese';
import {minBy, sortBy} from 'lodash';
import {scheduleJob} from 'node-schedule';
import type {SlackInterface} from '../lib/slack';
import {getMemberIcon, getMemberName} from '../lib/slackUtils';
import State from '../lib/state';
import answerQuestionDialog from './views/answerQuestionDialog';
import listAnswersDialog from './views/listAnswersDialog';
import listQuizDialog from './views/listQuizDialog';
import registerQuizDialog from './views/registerQuizDialog';

export interface AnswerInfo {
	user: string,
	progress: number,
	date: number,
	answer: string,
}

export interface Game {
	id: string,
	status: 'waitlisted' | 'inprogress' | 'finished',
	author: string,

	question: string,
	answer: string,
	ruby: string,
	hint: string | null,

	registrationDate: number,
	startDate: number | null,
	finishDate: number | null,

	progress: number,
	correctAnswers: AnswerInfo[],
	wrongAnswers: AnswerInfo[],
	answeredUsers: string[],
}

interface StateObj {
	games: Game[],
	latestStatusMessages: {ts: string, channel: string}[],
}

const mutex = new Mutex();

class SlowQuiz {
	slack: WebClient;

	slackInteractions: any;

	state: StateObj;

	previousTick: number;

	MAX_CORRECT_ANSWERS = 3;

	constructor({
		slack,
		slackInteractions,
	}: {
		slack: WebClient,
		slackInteractions: any,
	}) {
		this.slack = slack;
		this.slackInteractions = slackInteractions;
		this.previousTick = 0;
	}

	async initialize() {
		this.state = await State.init<StateObj>('slow-quiz', {
			games: [],
			latestStatusMessages: [],
		});

		this.slackInteractions.action({
			type: 'button',
			actionId: 'slowquiz_register_quiz_button',
		}, (payload: any) => {
			mutex.runExclusive(() => (
				this.showRegisterQuizDialog({
					triggerId: payload?.trigger_id,
				})
			));
		});

		this.slackInteractions.viewSubmission('slowquiz_register_quiz_dialog', (payload: any) => {
			const stateObjects = Object.values(payload?.view?.state?.values ?? {});
			const state = Object.assign({}, ...stateObjects);

			mutex.runExclusive(() => (
				this.registerQuiz({
					question: state?.question?.value,
					answer: state?.answer?.value,
					ruby: state?.ruby?.value,
					hint: state?.hint?.value,
					user: payload?.user?.id,
				})
			));
		});

		this.slackInteractions.action({
			type: 'button',
			actionId: 'slowquiz_list_quiz_button',
		}, (payload: any) => {
			mutex.runExclusive(() => (
				this.showListQuizDialog({
					triggerId: payload?.trigger_id,
					user: payload?.user?.id,
				})
			));
		});

		this.slackInteractions.action({
			type: 'button',
			actionId: 'slowquiz_delete_quiz_button',
		}, (payload: any) => {
			const action = (payload?.actions ?? []).find((action: any) => (
				action.action_id === 'slowquiz_delete_quiz_button'
			));
			mutex.runExclusive(() => (
				this.deleteQuiz({
					viewId: payload?.view?.id,
					id: action?.value,
					user: payload?.user?.id,
				})
			));
		});

		this.slackInteractions.action({
			type: 'button',
			actionId: 'slowquiz_answer_question_button',
		}, (payload: any) => {
			mutex.runExclusive(() => (
				this.showAnswerQuestionDialog({
					triggerId: payload.trigger_id,
					id: payload?.actions?.[0]?.value,
					user: payload?.user?.id,
					channel: payload?.channel?.id,
				})
			));
		});

		this.slackInteractions.viewSubmission('slowquiz_answer_question_dialog', (payload: any) => {
			const stateObjects = Object.values(payload?.view?.state?.values ?? {});
			const state = Object.assign({}, ...stateObjects);
			const id = payload?.view?.private_metadata;

			mutex.runExclusive(() => (
				this.answerQuestion({
					id,
					ruby: state?.ruby?.value,
					user: payload.user.id,
				})
			));
		});
	}

	showRegisterQuizDialog({triggerId}: {triggerId: string}) {
		return this.slack.views.open({
			trigger_id: triggerId,
			view: registerQuizDialog,
		});
	}

	showListQuizDialog({triggerId, user}: {triggerId: string, user: string}) {
		const games = this.state.games.filter((game) => (
			game.author === user && game.status === 'waitlisted'
		));
		return this.slack.views.open({
			trigger_id: triggerId,
			view: listQuizDialog(games),
		});
	}

	showAnswerQuestionDialog({
		triggerId,
		id,
		user,
		channel,
	}: {
		triggerId: string,
		id: string,
		user: string,
		channel: string,
	}) {
		const game = this.state.games.find((g) => g.id === id);

		if (!game) {
			this.postEphemeral('Error: 問題が見つかりません', user, channel);
			return null;
		}

		if (game.author === user) {
			const answerInfos = sortBy([
				...game.correctAnswers,
				...game.wrongAnswers ?? [],
			], (answer) => answer.date ?? 0);
			return this.slack.views.open({
				trigger_id: triggerId,
				view: listAnswersDialog(game, answerInfos),
			});
		}

		if (game.status !== 'inprogress') {
			this.postEphemeral('この問題の回答受付は終了しているよ🙄', user, channel);
			return null;
		}

		if (game.answeredUsers.includes(user)) {
			this.postEphemeral('今日はこの問題にすでに回答しているよ🙄', user, channel);
			return null;
		}

		if (game.correctAnswers.some((answer) => answer.user === user)) {
			this.postEphemeral('この問題にすでに正解しているよ🙄', user, channel);
			return null;
		}

		return this.slack.views.open({
			trigger_id: triggerId,
			view: answerQuestionDialog(game, this.getQuestionText(game)),
		});
	}

	async registerQuiz({
		question,
		answer,
		ruby,
		hint,
		user,
	}: {
		question: string,
		answer: string,
		ruby: string,
		hint: string,
		user: string,
	}): Promise<void> {
		if (typeof question !== 'string' || question.length === 0) {
			this.postEphemeral('問題を入力してね🙄', user);
			return;
		}

		if (typeof answer !== 'string' || answer.length === 0) {
			this.postEphemeral('答えを入力してね🙄', user);
			return;
		}

		if (typeof ruby !== 'string' || !ruby.match(/^[ぁ-ゟァ-ヿa-z0-9]+$/i)) {
			this.postEphemeral('読みがなに使える文字は「ひらがな・カタカナ・英数字」のみだよ🙄', user);
			return;
		}

		this.state.games.push({
			id: Math.floor(Math.random() * 10000000000).toString(),
			question,
			answer,
			ruby,
			hint: hint || null,
			author: user,
			registrationDate: Date.now(),
			startDate: null,
			finishDate: null,
			status: 'waitlisted',
			progress: 0,
			correctAnswers: [],
			wrongAnswers: [],
			answeredUsers: [],
		});

		await this.postShortMessage({
			text: `<@${user}>が1日1文字クイズの問題を登録したよ💪`,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `<@${user}>が1日1文字クイズの問題を登録したよ💪`,
					},
				},
			],
		});
	}

	answerQuestion({
		id,
		ruby,
		user,
	}: {
		id: string,
		ruby: string,
		user: string,
	}): Promise<void> {
		const game = this.state.games.find((g) => g.id === id);

		if (!game) {
			this.postEphemeral('Error: 問題が見つかりません', user);
			return null;
		}

		if (game.author === user) {
			this.postEphemeral('出題者は問題に答えることができないよ🙄', user);
			return null;
		}

		if (game.status !== 'inprogress' || game.correctAnswers.length >= this.MAX_CORRECT_ANSWERS) {
			this.postEphemeral('Error: この問題の回答受付は終了しています', user);
			return null;
		}

		if (game.answeredUsers.includes(user)) {
			this.postEphemeral('Error: この問題にすでに回答しています', user);
			return null;
		}

		if (!ruby.match(/^[ぁ-ゟァ-ヿa-z0-9]+$/i)) {
			this.postEphemeral('答えに使える文字は「ひらがな・カタカナ・英数字」のみだよ🙄', user);
			return null;
		}

		game.answeredUsers.push(user);

		const normalizedRuby: string = hiraganize(ruby).toLowerCase().trim();
		const normalizedCorrectRuby: string = hiraganize(game.ruby).toLowerCase().trim();

		if (normalizedRuby !== normalizedCorrectRuby) {
			if (game.wrongAnswers === undefined) {
				game.wrongAnswers = [];
			}
			game.wrongAnswers.push({
				user,
				progress: game.progress,
				date: Date.now(),
				answer: ruby,
			});
			this.postEphemeral('残念！🙄', user);
			this.updateLatestStatusMessages();
			return null;
		}

		game.correctAnswers.push({
			user,
			progress: game.progress,
			date: Date.now(),
			answer: ruby,
		});

		this.postEphemeral('正解です🎉🎉🎉', user);

		this.postShortMessage({
			text: `<@${user}>が1日1文字クイズに正解しました🎉🎉🎉`,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `<@${user}>が1日1文字クイズに正解しました🎉🎉🎉`,
					},
				},
				{
					type: 'context',
					elements: [
						{
							type: 'plain_text',
							text: this.getQuestionText(game),
						},
					],
				},
			],
		});

		this.checkGameEnd();

		this.updateLatestStatusMessages();

		return null;
	}

	deleteQuiz({viewId, id, user}: {viewId: string, id: string, user: string}) {
		const gameIndex = this.state.games.findIndex((g) => g.id === id);

		if (gameIndex === -1) {
			this.postEphemeral('Error: 問題が見つかりません', user);
			return null;
		}

		const game = this.state.games[gameIndex];

		if (game.status !== 'waitlisted') {
			this.postEphemeral('Error: 出題待ちの問題ではありません', user);
			return null;
		}

		this.state.games.splice(gameIndex, 1);

		const games = this.state.games.filter((game) => (
			game.author === user && game.status === 'waitlisted'
		));
		return this.slack.views.update({
			view_id: viewId,
			view: listQuizDialog(games),
		});
	}

	async progressGames() {
		const newGame = this.chooseNewGame();

		if (newGame !== null) {
			newGame.status = 'inprogress';
			newGame.startDate = Date.now();
		}

		for (const game of this.state.games) {
			if (game.status === 'inprogress') {
				game.progress++;
			}
			game.answeredUsers = [];
		}

		if (this.state.games.some((game) => game.status === 'inprogress')) {
			const blocks = await this.getGameBlocks();
			const messages = await this.postMessage({
				text: '現在開催中の1日1文字クイズ一覧',
				blocks,
			});

			this.state.latestStatusMessages = messages.map((message) => ({
				ts: message.ts,
				channel: message.channel,
			}));
		}
	}

	chooseNewGame() {
		// これまでの出題者のリスト
		const authorHistory = this.state.games
			.filter((game) => game.status !== 'waitlisted')
			.sort((a, b) => b.startDate - a.startDate)
			.map((game) => game.author);

		// 最近選ばれた順の出題者のリスト
		const uniqueAuthorHistory: string[] = [];
		for (const author of authorHistory) {
			if (!uniqueAuthorHistory.includes(author)) {
				uniqueAuthorHistory.push(author);
			}
		}

		// 一度も選ばれてないユーザーの問題から選ぶ
		const authorHistorySet = new Set(authorHistory);
		const unchosenGames = this.state.games
			.filter((game) => !authorHistorySet.has(game.author) && game.status === 'waitlisted');

		if (unchosenGames.length > 0) {
			return minBy(unchosenGames, (game) => game.registrationDate);
		}

		// 最近選ばれていないユーザーを優先して選ぶ
		for (const author of uniqueAuthorHistory.slice().reverse()) {
			const authorGames = this.state.games
				.filter((game) => game.author === author && game.status === 'waitlisted');
			if (authorGames.length > 0) {
				return minBy(authorGames, (game) => game.registrationDate);
			}
		}

		// あきらめ
		return null;
	}

	async checkGameEnd() {
		for (const game of this.state.games) {
			if (game.status !== 'inprogress') {
				continue;
			}

			if (game.correctAnswers.length >= this.MAX_CORRECT_ANSWERS) {
				game.status = 'finished';
				game.finishDate = Date.now();

				this.postMessage({
					blocks: [
						{
							type: 'header',
							text: {
								type: 'plain_text',
								text: '～回答受付終了～',
								emoji: true,
							},
						},
						{
							type: 'section',
							text: {
								type: 'mrkdwn',
								text: stripIndent`
									＊Q. ${game.question}＊

									＊A. ${game.answer} (${game.ruby})＊

									出題者: <@${game.author}>
									${game.hint ? `ヒント: ${game.hint}` : ''}
								`,
							},
						},
						{
							type: 'header',
							text: {
								type: 'plain_text',
								text: '正解者一覧',
								emoji: true,
							},
						},
						...await Promise.all(game.correctAnswers.map(async (answer, i) => ({
							type: 'context',
							elements: [
								{
									type: 'mrkdwn',
									text: `*${i + 1}位* <@${answer.user}> (${answer.progress}文字)`,
								},
								{
									type: 'image',
									image_url: await getMemberIcon(answer.user),
									alt_text: await getMemberName(answer.user),
								},
							],
						}))),
					],
				});
			}
		}
	}

	async updateLatestStatusMessages() {
		const blocks = await this.getGameBlocks();

		for (const message of this.state.latestStatusMessages) {
			await this.slack.chat.update({
				ts: message.ts,
				channel: message.channel,
				text: '現在開催中の1日1文字クイズ一覧',
				blocks,
			});
		}
	}

	async getGameBlocks(): Promise<KnownBlock[]> {
		const ongoingGames = this.state.games.filter((game) => game.status === 'inprogress');

		if (ongoingGames.length === 0) {
			return [{
				type: 'section',
				text: {
					type: 'plain_text',
					text: '現在開催中の1日1文字クイズはないよ！',
				},
			}];
		}

		const blocks = [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: '＊現在開催中のクイズ＊',
				},
			},
		] as KnownBlock[];

		for (const game of ongoingGames) {
			const questionText = this.getQuestionText(game);

			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `＊Q. ${questionText}＊`,
				},
				accessory: {
					type: 'button',
					text: {
						type: 'plain_text',
						text: '回答する',
						emoji: true,
					},
					value: game.id,
					style: 'primary',
					action_id: 'slowquiz_answer_question_button',
				},
			});

			blocks.push({
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: [
							`${await getMemberName(game.author)} さんの問題`,
							`本日${game.answeredUsers.length}人回答`,
							`${game.correctAnswers.length}人正解済み`,
						].join(' / '),
					},
					...await Promise.all(game.correctAnswers.map(async (correctAnswer) => ({
						type: 'image',
						image_url: await getMemberIcon(correctAnswer.user),
						alt_text: await getMemberName(correctAnswer.user),
					} as ImageElement))),
				],
			});
		}

		return blocks;
	}

	getQuestionText(game: Game) {
		const characters = Array.from(game.question);
		return characters.map((char, i) => {
			if (i === characters.length - 1) {
				if (['。', '？', '?'].includes(char)) {
					return char;
				}
			}
			if (i < game.progress) {
				return char;
			}
			return '◯';
		}).join('\u200B');
	}

	async postMessage(message: Partial<ChatPostMessageArguments>) {
		const messages = [];

		for (const channel of [process.env.CHANNEL_SANDBOX, process.env.CHANNEL_QUIZ]) {
			const response = await this.slack.chat.postMessage({
				channel,
				username: '1日1文字クイズ',
				icon_emoji: ':face_with_rolling_eyes:',
				...message,
				blocks: [
					...(message.blocks ?? []),
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: '*1日1文字クイズ ルール*\n\n● 1問につき1日1回のみ回答することができます。\n● 回答するために検索や調査を行うのはOKです。\n● 正解者が3人出たら終了します。',
						},
					},
					{
						type: 'actions',
						elements: [
							{
								type: 'button',
								text: {
									type: 'plain_text',
									text: '問題を登録する',
									emoji: true,
								},
								style: 'primary',
								action_id: 'slowquiz_register_quiz_button',
							},
							{
								type: 'button',
								text: {
									type: 'plain_text',
									text: '登録した問題を見る',
									emoji: true,
								},
								action_id: 'slowquiz_list_quiz_button',
							},
						],
					},
				],
			});
			messages.push(response);
		}

		return messages;
	}

	postShortMessage(message: Partial<ChatPostMessageArguments>) {
		return this.slack.chat.postMessage({
			channel: process.env.CHANNEL_SANDBOX,
			username: '1日1文字クイズ',
			icon_emoji: ':face_with_rolling_eyes:',
			...message,
		});
	}

	postEphemeral(message: string, user: string, channel: string = process.env.CHANNEL_SANDBOX) {
		return this.slack.chat.postEphemeral({
			channel,
			text: message,
			user,
		});
	}
}

export default async ({webClient: slack, messageClient: slackInteractions}: SlackInterface) => {
	const slowquiz = new SlowQuiz({slack, slackInteractions});
	await slowquiz.initialize();

	scheduleJob('0 10 * * *', () => {
		mutex.runExclusive(() => {
			slowquiz.progressGames();
		});
	});
};
