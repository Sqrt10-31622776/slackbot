const axios = require("axios");
const emoji = require("node-emoji");
const download = require("download");
const {promises: fs, constants} = require("fs");
const path = require("path");
const {sample, get} = require("lodash");
const {hiraganize} = require("japanese");
const {stripIndents} = require("common-tags");
const {unlock, increment} = require("../achievements");
const {default: logger} = require('../lib/logger.ts');
const {getMemberName} = require('../lib/slackUtils');
const {default: State} = require('../lib/state.ts');

const stripRe = /^[、。？！,.，．…・?!：；:;\s]+|[、。？！,.，．…・?!：；:;\s]+$/g;
const kanaOnlyRe = /^[\u3040-\u309F\u30A0-\u30FF]+$/;

const ignoreRe = /( 英語| 韓国語| 中国語|の?意味|meaning|とは)+$/i;

async function getSuggestions(text) {
	const response = await axios({
		url: "https://www.google.com/complete/search",
		params: {
			client: "firefox",
			hl: "ja",
			q: text,
		},
		headers: {
			"User-Agent": "Mozilla/5.0",
		},
		method: "GET",
	});
	return get(response, ['data', 1], []);
}

async function reply(text, index) {
	try {
		const suggestions = await getSuggestions(text);
		return generateReply(text, suggestions, index);
	} catch (e) {
		logger.error(e);
		return "エラーΩ＼ζ°)ﾁｰﾝ";
	}
}

function generateReply(text, words, index) {
	// logger.info(text, words, index);
	const strippedText = text.replace(stripRe, "");
	const normalizedText = normalize(strippedText);
	const isAlphabet = /[a-z]$/.test(normalizedText);
	const trailers = words.map((word) => {
		const myWord = word.replace(ignoreRe, "").trim();
		if (!normalize(myWord).startsWith(normalizedText)) {
			return false;
		}
		const trailer = myWord.slice(normalizedText.length);
		// let result = "";
		// for (const token of trailer.split(/(\s+)/)) {
		// 	result += token;
		// 	if (token.replace(stripRe, "") !== "") {
		// 		break;
		// 	}
		// }
		const result = trailer;
		return normalize(result).replace(stripRe, "") ? result : false;
	}).filter(Boolean);
	let sortedTrailers = trailers;
	if (!isAlphabet) {
		const trailersSpaced = [];
		const trailersNospaced = [];
		trailers.forEach((trailer) => {
			(trailer[0] === " " ? trailersSpaced : trailersNospaced).push(trailer);
		});
		sortedTrailers = trailersNospaced.concat(trailersSpaced);
	}
	// logger.info(sortedTrailers);
	if (sortedTrailers.length <= index) {
		return null;
	}
	return sortedTrailers[index].replace(stripRe, "");
}

function slackDecode(text) {
	let result = text.replace(/<([^>]+)>/g, (str, cont) => {
		let m = /.+\|(.+)/.exec(cont);
		if (m) {
			return m[1];
		}
		if (/^[@#!]/.test(cont)) {
			return "";
		}
		return cont;
	}).replace(/&(lt|gt|amp);/g, (str, m1) => ({
		lt: "<",
		gt: ">",
		amp: "&",
	}[m1]));
	result = emoji.emojify(result);
	result = result.replace(/^>\s*/mg, ""); // blockquote
	result = result.trim();
	return result;
}

function htmlEscape(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function normalize(text) {
	return text
		.normalize("NFKC")
		.replace(/\ufe0f/g, "")
		.replace(/\u200d/g, " ")
		.replace(/\u301c/g, "~")
		.toLowerCase();
}

async function getDictionary() {
	const dictionaryPath = path.resolve(__dirname, 'kanjibox.txt');
	const exists = await fs.access(dictionaryPath, constants.R_OK).then(() => true).catch(() => false);
	if (!exists) {
		await download("https://hakata-public.s3-ap-northeast-1.amazonaws.com/slackbot/kanjibox.txt", __dirname, {filename: 'kanjibox.txt'});
	}
	const dictionary = await fs.readFile(dictionaryPath);
	const entries = dictionary.toString().split('\n').filter((line) => (
		!line.startsWith('#') && line.length !== 0)
	).map((line) => {
		const [, word, ruby] = line.split('\t');
		return {word, ruby};
	});
	return entries;
}

module.exports = async (clients) => {
	const { rtmClient: rtm, webClient: slack } = clients;

	const state = await State.init('pocky', {
		quineSolutions: [],
		longQuineSolutions: [],
	});

	function postMessage(message, channel, postThreadOptions = {}) {
		const {broadcast, threadPosted} = {
			broadcast: false,
			threadPosted: null,
			...postThreadOptions,
		}
		return slack.chat.postMessage({
			channel,
			text: message,
			as_user: false,
			username: "hakatashi pocky",
			icon_emoji: ":google:",
			thread_ts: threadPosted ? threadPosted : null,
			reply_broadcast: broadcast,
		});
	}

	let theme = null;
	let thread = null;
	let hints = [];

	let shiritoriThread = null;
	let shiritoriState = {
		lastWord: null,
		lastResponse: null,
		lastUser: null,
	};

	async function pockygame() {
		if (theme !== null) {
			return;
		}

		const entries = await getDictionary();

		let failures = 0;

		while (failures <= 5 && theme === null) {
			const entry = sample(entries);
			const suggestions = await getSuggestions(entry.word);
			hints = suggestions.filter((hint) => hint !== entry.word && hint.startsWith(entry.word));
			if (hints.length >= 5) {
				theme = entry;
			}
			failures++;
		}

		if (theme === null) {
			postMessage("エラーΩ＼ζ°)ﾁｰﾝ", process.env.CHANNEL_SANDBOX);
			return;
		}
		logger.info(theme);

		const message = await postMessage(stripIndents`
			ポッキーゲームを始めるよ～
			${hints.map((hint) => hint.replaceAll(theme.word, '〇〇')).join(' / ')}
		`, process.env.CHANNEL_SANDBOX, {broadcast: false});

		thread = message.ts;

		await postMessage(stripIndents`
			下の単語の〇〇に共通して入る単語は何かな～？
			スレッドで回答してね!
			3分経過で答えを発表するよ～

			${hints.map((hint) => `• ${hint.replaceAll(theme.word, '〇〇')}`).join('\n')}
		`, process.env.CHANNEL_SANDBOX, {broadcast: false, threadPosted: thread});

		const currentTheme = theme;
		setTimeout(async () => {
			if (theme === currentTheme) {
				await postMessage(stripIndents`
					なんでわからないの？
					答えは＊${theme.word}＊ (${theme.ruby}) だよ:anger:
				`, process.env.CHANNEL_SANDBOX, {broadcast: true, threadPosted: thread});
				await postMessage(stripIndents`
					${hints.map((hint) => hint.replace(theme.word, `• ＊${theme.word}＊`)).join('\n')}
				`, process.env.CHANNEL_SANDBOX, {broadcast: false, threadPosted: thread});
				theme = null;
				thread = null;
			}
		}, 3 * 60 * 1000);
	};

	async function pockyshiritori(ts) {
		const message = await postMessage(stripIndents`
			ポッキーしりとりを始めるよ～
			スレッドに回答してね!
		`, process.env.CHANNEL_SANDBOX, {broadcast: true, threadPosted: ts});

		shiritoriThread = ts;
	};

	rtm.on('message', async (message) => {
		if (message.subtype) {
			return;
		}
		const { channel, text, thread_ts, ts } = message;
		if (theme !== null && thread_ts === thread) {
			if (text === theme.word || hiraganize(text) === hiraganize(theme.ruby)) {
				const {word, ruby} = theme;
				theme = null;

				await postMessage(stripIndents`
					<@${message.user}> 正解:tada:
					答えは＊${word}＊ (${ruby}) だよ:tada:
				`, channel, {broadcast: true, threadPosted: thread});
				await postMessage(stripIndents`
					${hints.map((hint) => hint.replace(word, `• ＊${word}＊`)).join('\n')}
				`, channel, {broadcast: false, threadPosted: thread});
				increment(message.user, "pockygame-win");
				const date = new Date().toLocaleString('en-US', {
					timeZone: 'Asia/Tokyo',
					month: 'numeric',
					day: 'numeric',
				});
				if (date === '11/11') {
					unlock(message.user, "pockygame-on-nov-11");
				}

				thread = null;
				return;
			} else {
				slack.reactions.add({
					name: 'no_good',
					channel: channel,
					timestamp: ts,
				});
			}
		}
		if (channel !== process.env.CHANNEL_SANDBOX) {
			return;
		}
		if (false && text === 'ポッキーゲーム') {
			pockygame();
			return;
		}
		if (shiritoriThread === null && text === 'ポッキーしりとり') {
			pockyshiritori(ts);
			return;
		}
		const query = slackDecode(text.trim());
		const match = /([\s\S]+?)([？?]+)$/.exec(query);
		if (!match) {
			return;
		}
		const result = await reply(match[1], match[2].length - 1);
		if (shiritoriThread === thread_ts) {
			if (shiritoriState.lastUser === message.user) {
				await postMessage('同じ人が連続してしりとりしてるよ～', channel, {broadcast: false, threadPosted: shiritoriThread});
				return;
			}
			if (!match[1].match(kanaOnlyRe)) {
				await postMessage('ひらがな/カタカナ以外は使えないよ～', channel, {broadcast: false, threadPosted: shiritoriThread});
				return;
			}
			if (result === null) {
				await postMessage(stripIndents`
					結果が返ってこなかったよ:cry:
					<@${shiritoriState.lastUser}>の勝ち:tada:
				`, channel, {broadcast: true, threadPosted: shiritoriThread});
				shiritoriThread = null;
				shiritoriState = {
					lastWord: null,
					lastResponse: null,
					lastUser: null,
				};
				return;
			}
			await postMessage(htmlEscape(result), channel, {broadcast: false, threadPosted: shiritoriThread});
			if (!result.match(kanaOnlyRe)) {
				await postMessage('ひらがな/カタカナ以外が返ってきたよ\nもう一回!', channel, {broadcast: false, threadPosted: shiritoriThread});
				return;
			}
			if (shiritoriState.lastWord !== null && shiritoriState.lastResponse !== null) {
				const expectedWordPrefix = hiraganize(Array.from(shiritoriState.lastWord).slice(-1)[0]);
				const expectedResponsePrefix = hiraganize(Array.from(shiritoriState.lastResponse).slice(-1)[0]);

				const wordPrefix = hiraganize(Array.from(match[1])[0]);
				const responsePrefix = hiraganize(Array.from(result)[0]);

				if (expectedWordPrefix !== wordPrefix || expectedResponsePrefix !== responsePrefix) {
					await postMessage(stripIndents`
						しりとりが成立しなかったよ:cry:
						<@${shiritoriState.lastUser}>の勝ち:tada:
					`, channel, {broadcast: false, threadPosted: shiritoriThread});
					shiritoriThread = null;
					shiritoriState = {
						lastWord: null,
						lastResponse: null,
						lastUser: null,
					};
					return;
				}
			}
			shiritoriState.lastWord = match[1];
			shiritoriState.lastResponse = result;
			shiritoriState.lastUser = message.user;
			const nextWordPrefix = hiraganize(Array.from(shiritoriState.lastWord).slice(-1)[0]);
			const nextResponsePrefix = hiraganize(Array.from(shiritoriState.lastResponse).slice(-1)[0]);
			if (nextWordPrefix === 'ん' || nextResponsePrefix === 'ん') {
				await postMessage(stripIndents`
					んで終わっちゃったよ:cry:
					<@${shiritoriState.lastUser}>の勝ち:tada:
				`, channel, {broadcast: false, threadPosted: shiritoriThread});
				shiritoriThread = null;
				shiritoriState = {
					lastWord: null,
					lastResponse: null,
					lastUser: null,
				};
				return;
			}
			await postMessage(stripIndents`
				次は「${nextWordPrefix}」から始まる言葉で「${nextResponsePrefix}」から始まる言葉を返してね:thinking_face:
			`, channel, {broadcast: false, threadPosted: shiritoriThread});
		} else if (result !== null) {
			postMessage(htmlEscape(result), channel, {broadcast: false, threadPosted: thread_ts});
			unlock(message.user, "pocky");
			getMemberName(message.user).then((value) => {
				if (value === result) {
					unlock(message.user, "self-pocky");
				}
			}, (error) => {
				logger.error("error:", error.message);
			});
			if (Array.from(result).length >= 20) {
				unlock(message.user, "long-pocky");
			}
			if (match[1] === result && !state.quineSolutions.includes(result)) {
				unlock(message.user, "quine-pocky");
				state.quineSolutions.push(result);
			}
			if (Array.from(result).length >= 20 && match[1] === result && !state.longQuineSolutions.includes(result)) {
				unlock(message.user, "long-quine-pocky");
				state.longQuineSolutions.push(result);
			}
			const date = new Date().toLocaleString('en-US', {
				timeZone: 'Asia/Tokyo',
				month: 'numeric',
				day: 'numeric',
			});
			if (date === '11/11') {
				unlock(message.user, "pocky-on-nov-11");
			}
		}
	});
};
