import axios, {AxiosError} from 'axios';
import logger from '../../lib/logger';
import {SynthesizeFunction} from './types.d';

const voiceMapping: { [name: string]: { [emo: string]: number } } = {
	metan: {
		normal: 0,
		happiness: 2,
		anger: 4,
		sadness: 6,
	},
	zundamon: {
		normal: 1,
		happiness: 3,
		anger: 5,
		sadness: 7,
	},
	tsumugi: {
		normal: 8,
	},
	ritsu: {
		normal: 9,
	},
	hau: {
		normal: 10,
	},
	takehiro: {
		normal: 11,
	},
	torataro: {
		normal: 12,
	},
	ryusei: {
		normal: 13,
	},
	himari: {
		normal: 14,
	},
	sora: {
		normal: 15,
		hapiness: 16,
		anger: 17,
		sadness: 18,
	},
	sora_whisper: {
		normal: 19,
	},
	mochiko: {
		normal: 20,
	},
};

const speech: SynthesizeFunction = (text: string, voiceType: string, {speed, emotion}) => {
	const emoDict = voiceMapping[voiceType];
	const postData = {
		text,
		speaker: emoDict[emotion || 'normal'] || emoDict.normal,
		speed: 1.0 + (speed - 1.0) / 2,
	};
	return new Promise((resolve, reject) => {
		axios.post<Buffer>(process.env.VOICEVOX_API_URL, postData, {
			headers: {
				'content-type': 'application/json',
			},
			responseType: 'arraybuffer',
		}).then((response) => {
			resolve({data: response.data});
		}).catch((reason: AxiosError) => {
			logger.error(`The VoiceVox API server has returned an error: ${reason.response?.data?.toString()}`);
			reject(reason);
		});
	});
};

export default speech;
