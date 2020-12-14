/* eslint-env jest */

import {inspect} from 'util';
import {extractValidAnswers} from './hayaoshiUtils';

const testCases: [string, string, string[]][] = [
	['', 'リトグラフ[lithograph]【「石版画」「石版印刷」「リトグラフィー[lithographie]」も○】',
		['リトグラフ', 'lithograph', '石版画', '石版印刷', 'リトグラフィー', 'lithographie'],
	],
	['', '(3) 25本', ['25本']],
	['', 'リッピング [ripping]', ['リッピング', 'ripping']],
	['', 'ガイナーレ鳥取', ['ガイナーレ鳥取']],
	['', 'サムギョプサル[三겹살、삼겹살]【「サムギョッサル」も○】', [
		'サムギョプサル', '三겹살', '삼겹살', 'サムギョッサル',
	]],
	['', 'Parental Guidance(ペアレンタル・ガイダンス)', [
		'Parental Guidance', 'ペアレンタル・ガイダンス',
	]],
	['', '利休箸(利久箸)', ['利休箸', '利久箸']],
	['', '外字 [external character]', ['外字', 'external character']],
	['', '(スティーブン・)フォスター', ['フォスター', 'スティーブン・フォスター']],
	['', '(ザ・)ローリング・ストーンズ', ['ローリング・ストーンズ', 'ザ・ローリング・ストーンズ']],
	['', 'サニタイジング（サニタイズ、無害化）', ['サニタイジング', 'サニタイズ', '無害化']],
	['', '巡回セールスマン問題（旅商人問題） [Traveling Salesman Problem, TSP]', [
		'巡回セールスマン問題', '旅商人問題', 'Traveling Salesman Problem', 'TSP',
	]],
	['', '小塚昌彦（こづか・まさひこ）', ['小塚昌彦', 'こづか・まさひこ']],
	['', 'モンキーテスト【△ランダム-、アドホック-】', ['モンキーテスト']],
	['', 'メールサーバー名【△ゾーンファイル】', ['メールサーバー名', 'ゾーンファイル']],
	['', 'ユーロセント【「セント」のみで○】', ['ユーロセント', 'セント']],
	['', '日本経済団体連合会【「日本経団連」「経団連」でも○】', [
		'日本経済団体連合会', '日本経団連', '経団連',
	]],
	['', 'MACアドレス【※MACで◯】', ['MACアドレス', 'MAC']],
	['', 'ボスが来た【パニックモード、パニック画面】', ['ボスが来た', 'パニックモード', 'パニック画面']],
	['', '『伽藍（がらん）とバザール』', ['『伽藍とバザール』']],
	['', '空海【「佐伯真魚(さえきのまお・俗名)」もおまけで○】', ['空海', '佐伯真魚', 'さえきのまお・俗名']],
	['', '国際原子力機関 (IAEA: International Atomic Energy Agency)', [
		'国際原子力機関', 'IAEA', 'International Atomic Energy Agency',
	]],
	['', '親ディレクトリ【ニュアンス合えば○】', ['親ディレクトリ']],
	['', '月並み(つきなみ) ※月並・月次でもOK', ['月並み', 'つきなみ', '月並', '月次']],
	['', 'HAL【モード学園はもう一度】', ['HAL', 'モード学園']],
	['', '翻訳エンジン【翻訳が出れば○】', ['翻訳エンジン']],
	['', 'ZIF [Zero Insertion Force] (ジフ)', ['ZIF', 'Zero Insertion Force', 'ジフ']],
	['', 'ジオメトリ処理【T&L処理】', ['ジオメトリ処理', 'T&L処理']],
	['', 'JIRA【×Bugzilla】', ['JIRA']],
	['', '千原兄弟(ちはらきょうだい) ※千原のみでは×', ['千原兄弟', 'ちはらきょうだい']],
	['', 'ボビー・バレンタイン【ロバート・ジョン・ヴァレンタイン/Robert John Valentine】', [
		'ボビー・バレンタイン', 'ロバート・ジョン・ヴァレンタイン', 'Robert John Valentine',
	]],
	[
		'日本オリンピック委員会の第2代会長を務めた、「フジヤマのトビウオ」の異名で知られた往年の水泳選手は誰でしょう？',
		'古橋広之進',
		['古橋広之進'],
	],
	[
		'アメリカ化学会が与える賞にも名を残す、1774年に酸素を発見したことで知られるイギリスの化学者は誰でしょう？',
		'ジョゼフ・プリーストリー',
		['ジョゼフ・プリーストリー', 'プリーストリー'],
	],
	[
		'ブランデーをしみこませた角砂糖に火をつけて入れ、溶かして飲むコーヒーを何というでしょう？',
		'カフェ・ロワイヤル',
		['カフェ・ロワイヤル'],
	],
	[
		'父親の友人であったエジプト王サイド・パシャの許可を得て、スエズ運河建設の指揮をとった人物といえば誰でしょう？',
		'フェルナンド・デ・レセップス',
		['フェルナンド・デ・レセップス', 'レセップス'],
	],
	[
		'息子の義尚(よしひさ)の将軍後継を図って応仁の乱のきっかけをつくったという、足利義政の妻は誰でしょう？',
		'日野富子[ひの・とみこ]',
		['日野富子', 'ひの・とみこ'],
	],
];

describe('extractValidAnswers', () => {
	for (const [problem, answer, expected] of testCases) {
		it(`converts ${inspect(answer)} to ${inspect(expected)}`, () => {
			const sortedResult = extractValidAnswers(problem, answer).slice().sort();
			const sortedExpected = expected.slice().sort();
			expect(sortedResult).toStrictEqual(sortedExpected);
		});
	}
});
